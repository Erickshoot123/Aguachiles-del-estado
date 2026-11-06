import { Prisma, type PrismaClient } from '@prisma/client';
import type { OperationalAnalytics } from '@aguachiles/shared';
import { getLocalLocation } from '../locations/localLocation.repository.js';
import { mandaditoSummary } from '../cash/mandaditoSummary.js';

export async function getOperationalAnalytics(
  db: PrismaClient,
  from: Date,
  to: Date,
): Promise<OperationalAnalytics> {
  const location = await getLocalLocation(db);
  const sales = await db.sale.findMany({
    where: {
      locationId: location.id,
      paidAt: { gte: from, lt: to },
      status: { in: ['completed', 'partially_refunded', 'refunded'] },
    },
    include: {
      items: { include: { refundItems: true } },
      refunds: true,
      payments: { include: { paymentMethod: true } },
    },
  });
  const mix = ['green', 'red', 'black'].flatMap((flavor) =>
    ['kilo', 'half_kilo'].map((size) => ({ flavor, size, units: 0, kilos: 0 })),
  );
  const payments = new Map<
    string,
    {
      name: string;
      amount: Prisma.Decimal;
      orders: Set<string>;
      refunds: Prisma.Decimal;
      expenses: Prisma.Decimal;
    }
  >();
  let food = new Prisma.Decimal(0);
  for (const sale of sales) {
    const refunds = sale.refunds.reduce(
      (sum, refund) => sum.add(refund.totalRefunded),
      new Prisma.Decimal(0),
    );
    food = food.add(Prisma.Decimal.max(0, sale.total.sub(sale.deliveryFee).sub(refunds)));
    for (const item of sale.items) {
      const row = mix.find(
        (entry) => entry.flavor === item.menuFlavor && entry.size === item.portionSize,
      );
      if (!row) continue;
      const refunded = item.refundItems.reduce(
        (sum, refund) => sum.add(refund.quantity),
        new Prisma.Decimal(0),
      );
      row.units += item.quantity.sub(refunded).toNumber();
      row.kilos = row.units * (row.size === 'kilo' ? 1 : 0.5);
    }
    for (const payment of sale.payments) {
      const entry = payments.get(payment.paymentMethodId) ?? {
        name: payment.paymentMethod.name,
        amount: new Prisma.Decimal(0),
        orders: new Set<string>(),
        refunds: new Prisma.Decimal(0),
        expenses: new Prisma.Decimal(0),
      };
      entry.amount = entry.amount.add(payment.amount);
      entry.orders.add(payment.id);
      payments.set(payment.paymentMethodId, entry);
    }
  }
  const outflows = await db.cashMovement.findMany({
    where: {
      OR: [{ type: 'refund' }, { type: 'expense', category: 'mandadito' }],
      createdAt: { gte: from, lt: to },
      session: { cashRegister: { locationId: location.id } },
    },
    include: { paymentMethod: true },
  });
  for (const refund of outflows) {
    const id = refund.paymentMethodId ?? 'unknown';
    const entry = payments.get(id) ?? {
      name: refund.paymentMethod?.name ?? 'Sin método',
      amount: new Prisma.Decimal(0),
      orders: new Set<string>(),
      refunds: new Prisma.Decimal(0),
      expenses: new Prisma.Decimal(0),
    };
    if (refund.type === 'refund') entry.refunds = entry.refunds.add(refund.amount);
    else entry.expenses = entry.expenses.add(refund.amount);
    payments.set(id, entry);
  }
  return {
    orders: sales.length,
    foodSales: food.toNumber(),
    ...mandaditoSummary(outflows),
    averageTicket: sales.length ? food.div(sales.length).toNumber() : 0,
    mix,
    payments: [...payments.values()].map((entry) => ({
      name: entry.name,
      amount: entry.amount.toNumber(),
      refunds: entry.refunds.toNumber(),
      mandaditoExpenses: entry.expenses.toNumber(),
      net: entry.amount.sub(entry.refunds).sub(entry.expenses).toNumber(),
      transactions: entry.orders.size,
    })),
  };
}
