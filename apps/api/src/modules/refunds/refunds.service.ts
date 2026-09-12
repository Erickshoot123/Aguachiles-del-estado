import { Prisma, type PrismaClient } from '@prisma/client';
import type { CreateRefundRequest, RefundableSale, RefundResult } from '@aguachiles/shared';
import { recordAuditLog } from '../audit/audit.service.js';
import {
  EmptyRefundRequestError,
  RefundQuantityExceedsAvailableError,
  SaleItemNotFoundError,
  SaleNotFoundError,
  SaleNotRefundableError,
} from './refunds.errors.js';

type SaleItemWithRefunds = Prisma.SaleItemGetPayload<{
  include: { refundItems: true; product: true };
}>;

type SaleWithRefundableItems = Prisma.SaleGetPayload<{
  include: { items: { include: { refundItems: true; product: true } } };
}>;

const REFUNDABLE_STATUSES = ['completed', 'partially_refunded'] as const;

function refundedQuantityOf(item: SaleItemWithRefunds): Prisma.Decimal {
  return item.refundItems.reduce((sum, ri) => sum.add(ri.quantity), new Prisma.Decimal(0));
}

export async function getRefundableSale(prisma: PrismaClient, saleId: string): Promise<RefundableSale> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: { include: { refundItems: true, product: true } } },
  });
  if (!sale) {
    throw new SaleNotFoundError();
  }

  return {
    saleId: sale.id,
    ticketNumber: sale.ticketNumber,
    status: sale.status,
    items: sale.items.map((item) => {
      const refunded = refundedQuantityOf(item);
      return {
        saleItemId: item.id,
        productName: item.product.name,
        unitPrice: item.unitPrice.toNumber(),
        quantity: item.quantity.toNumber(),
        refundedQuantity: refunded.toNumber(),
        refundableQuantity: item.quantity.sub(refunded).toNumber(),
      };
    }),
  };
}

interface RefundLine {
  saleItemId: string;
  productId: string;
  quantity: Prisma.Decimal;
  amount: Prisma.Decimal;
}

function buildRefundLines(
  saleItems: SaleItemWithRefunds[],
  requested: CreateRefundRequest['items'],
): RefundLine[] {
  return requested.map((entry) => {
    const saleItem = saleItems.find((item) => item.id === entry.saleItemId);
    if (!saleItem) {
      throw new SaleItemNotFoundError();
    }

    const quantity = new Prisma.Decimal(entry.quantity);
    const refundable = saleItem.quantity.sub(refundedQuantityOf(saleItem));
    if (quantity.greaterThan(refundable)) {
      throw new RefundQuantityExceedsAvailableError(saleItem.product.name);
    }

    return {
      saleItemId: saleItem.id,
      productId: saleItem.productId,
      quantity,
      amount: saleItem.unitPrice.mul(quantity),
    };
  });
}

function nextSaleStatus(sale: SaleWithRefundableItems, lines: RefundLine[]): 'refunded' | 'partially_refunded' {
  const fullyRefunded = sale.items.every((item) => {
    const alreadyRefunded = refundedQuantityOf(item);
    const thisLine = lines.find((line) => line.saleItemId === item.id)?.quantity ?? new Prisma.Decimal(0);
    return alreadyRefunded.add(thisLine).greaterThanOrEqualTo(item.quantity);
  });
  return fullyRefunded ? 'refunded' : 'partially_refunded';
}

export async function createRefund(
  prisma: PrismaClient,
  saleId: string,
  userId: string,
  cashSessionId: string,
  input: CreateRefundRequest,
): Promise<RefundResult> {
  const refund = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: { items: { include: { refundItems: true, product: true } } },
    });
    if (!sale) {
      throw new SaleNotFoundError();
    }
    if (!REFUNDABLE_STATUSES.includes(sale.status as (typeof REFUNDABLE_STATUSES)[number])) {
      throw new SaleNotRefundableError();
    }

    const lines = buildRefundLines(sale.items, input.items);
    if (lines.length === 0) {
      throw new EmptyRefundRequestError();
    }
    const totalRefunded = lines.reduce((sum, line) => sum.add(line.amount), new Prisma.Decimal(0));

    const created = await tx.refund.create({
      data: {
        saleId,
        userId,
        reason: input.reason,
        totalRefunded,
        status: 'completed',
        items: {
          create: lines.map((line) => ({
            saleItemId: line.saleItemId,
            quantity: line.quantity,
            amount: line.amount,
          })),
        },
      },
    });

    const cashPaymentMethod = await tx.paymentMethod.findFirst({ where: { type: 'cash', isActive: true } });
    if (cashPaymentMethod) {
      await tx.cashMovement.create({
        data: {
          sessionId: cashSessionId,
          type: 'refund',
          paymentMethodId: cashPaymentMethod.id,
          amount: totalRefunded,
          description: `Reembolso ticket ${sale.ticketNumber}`,
          userId,
        },
      });
    }

    await tx.sale.update({
      where: { id: saleId },
      data: { status: nextSaleStatus(sale, lines) },
    });

    await recordAuditLog(tx, {
      userId,
      action: 'refund_created',
      entity: 'refund',
      entityId: created.id,
      newValue: {
        ticketNumber: sale.ticketNumber,
        reason: input.reason,
        totalRefunded: totalRefunded.toNumber(),
      },
    });

    return created;
  });

  return {
    id: refund.id,
    saleId: refund.saleId,
    totalRefunded: refund.totalRefunded.toNumber(),
  };
}
