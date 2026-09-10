import { Prisma, type CashRegisterSession, type PrismaClient, type User } from '@prisma/client';
import type { CashSessionHistoryItem, SalesReport } from '@aguachiles/shared';

type SaleWithRelations = Prisma.SaleGetPayload<{
  include: {
    items: { include: { product: true } };
    payments: { include: { paymentMethod: true } };
    user: true;
    refunds: { include: { items: true } };
  };
}>;

const REPORTABLE_STATUSES = ['completed', 'partially_refunded', 'refunded'] as const;

function refundedTotalOf(sale: SaleWithRelations): Prisma.Decimal {
  return sale.refunds.reduce((sum, refund) => sum.add(refund.totalRefunded), new Prisma.Decimal(0));
}

function refundedItemsOf(
  sale: SaleWithRelations,
  saleItemId: string,
): { amount: Prisma.Decimal; quantity: Prisma.Decimal } {
  const items = sale.refunds.flatMap((refund) => refund.items).filter((item) => item.saleItemId === saleItemId);
  return {
    amount: items.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0)),
    quantity: items.reduce((sum, item) => sum.add(item.quantity), new Prisma.Decimal(0)),
  };
}

interface Accumulator {
  totalSales: Prisma.Decimal;
  byDay: Map<string, { total: Prisma.Decimal; count: number }>;
  byCashier: Map<string, { userName: string; total: Prisma.Decimal; count: number }>;
  byProduct: Map<string, { productName: string; quantity: Prisma.Decimal; total: Prisma.Decimal }>;
  byPaymentMethod: Map<string, Prisma.Decimal>;
  byChannel: Map<string, { total: Prisma.Decimal; count: number }>;
}

function createAccumulator(): Accumulator {
  return {
    totalSales: new Prisma.Decimal(0),
    byDay: new Map(),
    byCashier: new Map(),
    byProduct: new Map(),
    byPaymentMethod: new Map(),
    byChannel: new Map(),
  };
}

function bumpTotalAndCount(
  map: Map<string, { total: Prisma.Decimal; count: number }>,
  key: string,
  amount: Prisma.Decimal,
): void {
  const current = map.get(key) ?? { total: new Prisma.Decimal(0), count: 0 };
  current.total = current.total.add(amount);
  current.count += 1;
  map.set(key, current);
}

function accumulateSale(acc: Accumulator, sale: SaleWithRelations): void {
  const netTotal = sale.total.sub(refundedTotalOf(sale));
  acc.totalSales = acc.totalSales.add(netTotal);

  const dayKey = sale.createdAt.toISOString().slice(0, 10);
  bumpTotalAndCount(acc.byDay, dayKey, netTotal);
  bumpTotalAndCount(acc.byChannel, sale.channel, netTotal);

  const cashier = acc.byCashier.get(sale.userId) ?? {
    userName: sale.user.name,
    total: new Prisma.Decimal(0),
    count: 0,
  };
  cashier.total = cashier.total.add(netTotal);
  cashier.count += 1;
  acc.byCashier.set(sale.userId, cashier);

  for (const item of sale.items) {
    const product = acc.byProduct.get(item.productId) ?? {
      productName: item.product.name,
      quantity: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
    };
    const refundedItem = refundedItemsOf(sale, item.id);
    product.quantity = product.quantity.add(item.quantity.sub(refundedItem.quantity));
    product.total = product.total.add(item.subtotal.sub(refundedItem.amount));
    acc.byProduct.set(item.productId, product);
  }

  const paymentScale = sale.total.greaterThan(0) ? netTotal.div(sale.total) : new Prisma.Decimal(0);
  for (const payment of sale.payments) {
    const current = acc.byPaymentMethod.get(payment.paymentMethod.name) ?? new Prisma.Decimal(0);
    acc.byPaymentMethod.set(payment.paymentMethod.name, current.add(payment.amount.mul(paymentScale)));
  }
}

function formatSalesReport(
  acc: Accumulator,
  ticketCount: number,
  from: Date,
  to: Date,
): SalesReport {
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totalSales: acc.totalSales.toNumber(),
    totalTickets: ticketCount,
    byDay: [...acc.byDay.entries()]
      .map(([date, v]) => ({ date, total: v.total.toNumber(), count: v.count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byCashier: [...acc.byCashier.entries()]
      .map(([userId, v]) => ({
        userId,
        userName: v.userName,
        total: v.total.toNumber(),
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total),
    byProduct: [...acc.byProduct.entries()]
      .map(([productId, v]) => ({
        productId,
        productName: v.productName,
        quantity: v.quantity.toNumber(),
        total: v.total.toNumber(),
      }))
      .sort((a, b) => b.total - a.total),
    byPaymentMethod: [...acc.byPaymentMethod.entries()]
      .map(([paymentMethodName, total]) => ({ paymentMethodName, total: total.toNumber() }))
      .sort((a, b) => b.total - a.total),
    byChannel: [...acc.byChannel.entries()]
      .map(([channel, v]) => ({
        channel: channel as SalesReport['byChannel'][number]['channel'],
        total: v.total.toNumber(),
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total),
  };
}

export async function getSalesReport(
  prisma: PrismaClient,
  from: Date,
  to: Date,
): Promise<SalesReport> {
  const sales = await prisma.sale.findMany({
    where: { status: { in: [...REPORTABLE_STATUSES] }, createdAt: { gte: from, lte: to } },
    include: {
      items: { include: { product: true } },
      payments: { include: { paymentMethod: true } },
      user: true,
      refunds: { include: { items: true } },
    },
  });

  const acc = createAccumulator();
  for (const sale of sales) {
    accumulateSale(acc, sale);
  }

  return formatSalesReport(acc, sales.length, from, to);
}

type CashSessionForHistory = CashRegisterSession & {
  cashRegister: { name: string };
  openedBy: User;
  closedBy: User | null;
};

function toCashSessionHistoryDto(session: CashSessionForHistory): CashSessionHistoryItem {
  return {
    id: session.id,
    cashRegisterName: session.cashRegister.name,
    openedByName: session.openedBy.name,
    closedByName: session.closedBy?.name ?? null,
    status: session.status,
    openedAt: session.openedAt.toISOString(),
    closedAt: session.closedAt ? session.closedAt.toISOString() : null,
    openingAmount: session.openingAmount.toNumber(),
    expectedClosingAmount: session.expectedClosingAmount
      ? session.expectedClosingAmount.toNumber()
      : null,
    actualClosingAmount: session.actualClosingAmount
      ? session.actualClosingAmount.toNumber()
      : null,
    difference: session.difference ? session.difference.toNumber() : null,
  };
}

const CASH_SESSION_HISTORY_LIMIT = 30;

export async function getCashSessionHistory(
  prisma: PrismaClient,
): Promise<CashSessionHistoryItem[]> {
  const sessions = await prisma.cashRegisterSession.findMany({
    include: { cashRegister: true, openedBy: true, closedBy: true },
    orderBy: { openedAt: 'desc' },
    take: CASH_SESSION_HISTORY_LIMIT,
  });

  return sessions.map(toCashSessionHistoryDto);
}
