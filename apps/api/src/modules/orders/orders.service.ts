import { Prisma, type PrismaClient } from '@prisma/client';
import type { CreateOrderRequest, Order } from '@aguachiles/shared';
import { NoOpenCashSessionError } from '../cash/cash.errors.js';
import { createReceiptForSale } from '../receipts/receipts.service.js';
import {
  CannotCancelPaidOrderError,
  CashPaymentMethodNotConfiguredError,
  InsufficientStockError,
  InvalidFulfillmentTransitionError,
  OrderAlreadyChargedError,
  OrderNotFoundError,
  ProductNotAvailableError,
} from './orders.errors.js';

const ACTIVE_BOARD_STATUSES = ['received', 'in_prep', 'waiting_pickup', 'in_delivery'] as const;
const FORWARD_SEQUENCE = ['in_prep', 'waiting_pickup', 'in_delivery', 'delivered'] as const;
const MAX_TICKET_NUMBER_RETRIES = 3;

function isTicketNumberCollision(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.['target']) &&
    (error.meta?.['target'] as string[]).includes('ticket_number')
  );
}

type SaleWithItems = Prisma.SaleGetPayload<{ include: { items: { include: { product: true } } } }>;

function toOrderDto(sale: SaleWithItems): Order {
  return {
    id: sale.id,
    ticketNumber: sale.ticketNumber,
    channel: sale.channel,
    fulfillmentStatus: sale.fulfillmentStatus,
    status: sale.status,
    createdAt: sale.createdAt.toISOString(),
    subtotal: sale.subtotal.toNumber(),
    taxTotal: sale.taxTotal.toNumber(),
    total: sale.total.toNumber(),
    items: sale.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity.toNumber(),
      unitPrice: item.unitPrice.toNumber(),
      subtotal: item.subtotal.toNumber(),
    })),
  };
}

async function nextTicketNumber(tx: Prisma.TransactionClient): Promise<string> {
  const salesCount = await tx.sale.count();
  return `#${1000 + salesCount + 1}`;
}

export async function listActiveOrders(prisma: PrismaClient): Promise<Order[]> {
  const sales = await prisma.sale.findMany({
    where: { fulfillmentStatus: { in: [...ACTIVE_BOARD_STATUSES] } },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return sales.map(toOrderDto);
}

export async function findOrderByTicketNumber(
  prisma: PrismaClient,
  ticketNumber: string,
): Promise<Order> {
  const sale = await prisma.sale.findUnique({
    where: { ticketNumber },
    include: { items: { include: { product: true } } },
  });
  if (!sale) {
    throw new OrderNotFoundError();
  }
  return toOrderDto(sale);
}

export async function createOrder(
  prisma: PrismaClient,
  userId: string,
  input: CreateOrderRequest,
): Promise<Order> {
  for (let attempt = 1; attempt <= MAX_TICKET_NUMBER_RETRIES; attempt += 1) {
    try {
      return await createOrderAttempt(prisma, userId, input);
    } catch (error) {
      if (!isTicketNumberCollision(error) || attempt === MAX_TICKET_NUMBER_RETRIES) {
        throw error;
      }
    }
  }
  throw new Error('No se pudo generar un folio de pedido único');
}

async function createOrderAttempt(
  prisma: PrismaClient,
  userId: string,
  input: CreateOrderRequest,
): Promise<Order> {
  const sale = await prisma.$transaction(async (tx) => {
    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { inventory: true },
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    let subtotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);
    const itemsToCreate = input.items.map((item) => {
      const product = productById.get(item.productId);
      if (!product) {
        throw new ProductNotAvailableError('desconocido');
      }

      const quantity = new Prisma.Decimal(item.quantity);
      if (!product.inventory || product.inventory.quantity.lessThan(quantity)) {
        throw new InsufficientStockError(product.name);
      }

      const lineSubtotal = product.price.mul(quantity);
      const lineTax = lineSubtotal.mul(product.taxRate).div(100);
      subtotal = subtotal.add(lineSubtotal);
      taxTotal = taxTotal.add(lineTax);

      return {
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        taxAmount: lineTax,
        subtotal: lineSubtotal,
        previousStock: product.inventory.quantity,
      };
    });

    const ticketNumber = await nextTicketNumber(tx);
    const total = subtotal.add(taxTotal);

    const created = await tx.sale.create({
      data: {
        ticketNumber,
        userId,
        channel: input.channel,
        status: 'pending',
        fulfillmentStatus: 'in_prep',
        subtotal,
        taxTotal,
        total,
        items: {
          create: itemsToCreate.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxAmount: item.taxAmount,
            subtotal: item.subtotal,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    for (const item of itemsToCreate) {
      const newStock = item.previousStock.sub(item.quantity);
      await tx.inventory.update({
        where: { productId: item.productId },
        data: { quantity: newStock },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: 'sale',
          quantity: item.quantity.neg(),
          previousStock: item.previousStock,
          newStock,
          referenceType: 'sale',
          referenceId: created.id,
          userId,
        },
      });
    }

    return created;
  });

  return toOrderDto(sale);
}

export async function advanceOrder(prisma: PrismaClient, orderId: string): Promise<Order> {
  const updated = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: orderId } });
    if (!sale) {
      throw new OrderNotFoundError();
    }

    const currentIndex = FORWARD_SEQUENCE.indexOf(
      sale.fulfillmentStatus as (typeof FORWARD_SEQUENCE)[number],
    );
    if (currentIndex === -1 || currentIndex === FORWARD_SEQUENCE.length - 1) {
      throw new InvalidFulfillmentTransitionError(sale.fulfillmentStatus);
    }

    const nextStatus = FORWARD_SEQUENCE[currentIndex + 1] as (typeof FORWARD_SEQUENCE)[number];
    return tx.sale.update({
      where: { id: orderId },
      data: { fulfillmentStatus: nextStatus },
      include: { items: { include: { product: true } } },
    });
  });

  return toOrderDto(updated);
}

export async function cancelOrder(prisma: PrismaClient, orderId: string): Promise<Order> {
  const order = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!sale) {
      throw new OrderNotFoundError();
    }
    if (sale.fulfillmentStatus === 'delivered' || sale.fulfillmentStatus === 'cancelled') {
      throw new InvalidFulfillmentTransitionError(sale.fulfillmentStatus);
    }
    if (sale.status !== 'pending') {
      throw new CannotCancelPaidOrderError();
    }

    for (const item of sale.items) {
      const inventory = await tx.inventory.findUnique({ where: { productId: item.productId } });
      if (!inventory) continue;

      const newStock = inventory.quantity.add(item.quantity);
      await tx.inventory.update({
        where: { productId: item.productId },
        data: { quantity: newStock },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: 'return',
          quantity: item.quantity,
          previousStock: inventory.quantity,
          newStock,
          referenceType: 'sale',
          referenceId: sale.id,
          userId: sale.userId,
          reason: 'Cancelación de pedido',
        },
      });
    }

    return tx.sale.update({
      where: { id: orderId },
      data: { fulfillmentStatus: 'cancelled', status: 'cancelled' },
      include: { items: { include: { product: true } } },
    });
  });

  return toOrderDto(order);
}

export async function chargeOrder(
  prisma: PrismaClient,
  orderId: string,
  userId: string,
  cashSessionId: string,
): Promise<Order> {
  const order = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: orderId } });
    if (!sale) {
      throw new OrderNotFoundError();
    }
    if (sale.status !== 'pending') {
      throw new OrderAlreadyChargedError();
    }

    const cashSession = await tx.cashRegisterSession.findUnique({ where: { id: cashSessionId } });
    if (!cashSession || cashSession.status !== 'open') {
      throw new NoOpenCashSessionError();
    }

    const cashPaymentMethod = await tx.paymentMethod.findFirst({
      where: { type: 'cash', isActive: true },
    });
    if (!cashPaymentMethod) {
      throw new CashPaymentMethodNotConfiguredError();
    }

    await tx.salePayment.create({
      data: { saleId: sale.id, paymentMethodId: cashPaymentMethod.id, amount: sale.total },
    });
    await tx.cashMovement.create({
      data: {
        sessionId: cashSessionId,
        type: 'sale_income',
        paymentMethodId: cashPaymentMethod.id,
        amount: sale.total,
        userId,
      },
    });

    const updatedSale = await tx.sale.update({
      where: { id: orderId },
      data: { status: 'completed', cashRegisterSessionId: cashSessionId },
      include: { items: { include: { product: true } } },
    });

    await createReceiptForSale(tx, updatedSale);

    return updatedSale;
  });

  return toOrderDto(order);
}
