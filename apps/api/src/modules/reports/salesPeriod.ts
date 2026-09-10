import { Prisma, type PrismaClient } from '@prisma/client';

export type SaleWithRelations = Prisma.SaleGetPayload<{
  include: {
    items: { include: { product: true } };
    payments: { include: { paymentMethod: true } };
    user: true;
    refunds: { include: { items: true } };
  };
}>;

export const REPORTABLE_STATUSES = ['completed', 'partially_refunded', 'refunded'] as const;

export function refundedTotalOf(sale: SaleWithRelations): Prisma.Decimal {
  return sale.refunds.reduce((sum, refund) => sum.add(refund.totalRefunded), new Prisma.Decimal(0));
}

export function refundedItemsOf(
  sale: SaleWithRelations,
  saleItemId: string,
): { amount: Prisma.Decimal; quantity: Prisma.Decimal } {
  const items = sale.refunds
    .flatMap((refund) => refund.items)
    .filter((item) => item.saleItemId === saleItemId);
  return {
    amount: items.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0)),
    quantity: items.reduce((sum, item) => sum.add(item.quantity), new Prisma.Decimal(0)),
  };
}

export async function fetchSalesForPeriod(
  prisma: PrismaClient,
  from: Date,
  to: Date,
): Promise<SaleWithRelations[]> {
  return prisma.sale.findMany({
    where: { status: { in: [...REPORTABLE_STATUSES] }, createdAt: { gte: from, lte: to } },
    include: {
      items: { include: { product: true } },
      payments: { include: { paymentMethod: true } },
      user: true,
      refunds: { include: { items: true } },
    },
  });
}
