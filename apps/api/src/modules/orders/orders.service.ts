import { Prisma, type PrismaClient } from '@prisma/client';
import type { ChargePayment, CreateOrderRequest, FulfillmentStatus, Order, SaleChannel } from '@aguachiles/shared';
import { NoOpenCashSessionError } from '../cash/cash.errors.js';
import { createReceiptForSale } from '../receipts/receipts.service.js';
import {
  CannotCancelPaidOrderError,
  InsufficientStockError,
  InvalidFulfillmentTransitionError,
  NoLocationConfiguredError,
  OrderAlreadyChargedError,
  OrderNotFoundError,
  PaymentAmountMismatchError,
  PaymentMethodNotFoundError,
  ProductNotAvailableError,
} from './orders.errors.js';

const ACTIVE_BOARD_STATUSES = ['received', 'in_prep', 'waiting_pickup', 'in_delivery'] as const;
const MAX_TICKET_NUMBER_RETRIES = 3;

// Un pedido de mostrador lo recoge quien lo pidió apenas está listo: no hay
// "esperando quien lo recoja" ni "en camino" porque el cliente ya está ahí.
// Solo delivery pasa por las cuatro etapas completas.
const FORWARD_SEQUENCE_BY_CHANNEL: Record<SaleChannel, readonly FulfillmentStatus[]> = {
  counter: ['in_prep', 'delivered'],
  delivery: ['in_prep', 'waiting_pickup', 'in_delivery', 'delivered'],
};

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
      };
    });

    const ticketNumber = await nextTicketNumber(tx);
    const total = subtotal.add(taxTotal);

    const location = await tx.location.findFirst({ where: { isActive: true } });
    if (!location) {
      throw new NoLocationConfiguredError();
    }

    const created = await tx.sale.create({
      data: {
        ticketNumber,
        userId,
        locationId: location.id,
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

    // La comprobación de arriba usa una lectura hecha antes de este punto,
    // así que por sí sola no evita que dos pedidos concurrentes por la
    // última unidad pasen ambos la validación. La garantía real es este
    // updateMany: la condición `quantity >= item.quantity` y el decremento
    // ocurren en una sola sentencia atómica, así que si dos transacciones
    // compiten por el mismo stock, como mucho una tiene `count > 0`.
    for (const item of itemsToCreate) {
      const claimed = await tx.inventory.updateMany({
        where: { productId: item.productId, quantity: { gte: item.quantity } },
        data: { quantity: { decrement: item.quantity } },
      });
      if (claimed.count === 0) {
        throw new InsufficientStockError(item.productName);
      }

      const inventory = await tx.inventory.findUniqueOrThrow({
        where: { productId: item.productId },
      });
      const newStock = inventory.quantity;
      const previousStock = newStock.add(item.quantity);

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: 'sale',
          quantity: item.quantity.neg(),
          previousStock,
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

    if (sale.fulfillmentStatus === 'cancelled') {
      throw new InvalidFulfillmentTransitionError(sale.fulfillmentStatus);
    }

    const sequence = FORWARD_SEQUENCE_BY_CHANNEL[sale.channel as SaleChannel];
    const currentIndex = sequence.indexOf(sale.fulfillmentStatus as FulfillmentStatus);

    let nextStatus: FulfillmentStatus;
    if (currentIndex === -1) {
      // El pedido quedó en un estado que ya no forma parte de la secuencia
      // de su canal (p. ej. un mostrador varado en "waiting_pickup" de
      // antes de que se simplificara su flujo, como pasó con el pedido
      // #1018). No hay un "siguiente paso" que tenga sentido dentro de la
      // secuencia actual, así que lo llevamos directo al estado final de su
      // canal en vez de bloquear al cajero con un 409 permanente.
      nextStatus = sequence[sequence.length - 1] as FulfillmentStatus;
    } else if (currentIndex === sequence.length - 1) {
      throw new InvalidFulfillmentTransitionError(sale.fulfillmentStatus);
    } else {
      nextStatus = sequence[currentIndex + 1] as FulfillmentStatus;
    }

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

async function applyChargePayments(
  tx: Prisma.TransactionClient,
  saleId: string,
  saleTotal: Prisma.Decimal,
  cashSessionId: string,
  userId: string,
  payments: ChargePayment[],
): Promise<void> {
  const paymentMethods = await tx.paymentMethod.findMany({
    where: { id: { in: payments.map((payment) => payment.paymentMethodId) }, isActive: true },
  });
  const paymentMethodById = new Map(paymentMethods.map((method) => [method.id, method]));

  const paidTotal = payments.reduce(
    (sum, payment) => sum.add(new Prisma.Decimal(payment.amount)),
    new Prisma.Decimal(0),
  );
  if (!paidTotal.equals(saleTotal)) {
    throw new PaymentAmountMismatchError();
  }

  for (const payment of payments) {
    const method = paymentMethodById.get(payment.paymentMethodId);
    if (!method) {
      throw new PaymentMethodNotFoundError();
    }
    const amount = new Prisma.Decimal(payment.amount);
    await tx.salePayment.create({
      data: { saleId, paymentMethodId: method.id, amount, reference: payment.reference },
    });
    await tx.cashMovement.create({
      data: { sessionId: cashSessionId, type: 'sale_income', paymentMethodId: method.id, amount, userId },
    });
  }
}

export async function chargeOrder(
  prisma: PrismaClient,
  orderId: string,
  userId: string,
  cashSessionId: string,
  payments: ChargePayment[],
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

    await applyChargePayments(tx, sale.id, sale.total, cashSessionId, userId, payments);

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
