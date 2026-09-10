import { Prisma, type PrismaClient } from '@prisma/client';
import type { AnalyticsDashboard, AnalyticsTopProduct, AnalyticsTrendPoint } from '@aguachiles/shared';
import { fetchSalesForPeriod, refundedItemsOf, refundedTotalOf } from '../reports/salesPeriod.js';

const TOP_PRODUCTS_LIMIT = 10;

interface ProductAccumulator {
  productName: string;
  quantity: Prisma.Decimal;
  revenue: Prisma.Decimal;
  cost: Prisma.Decimal;
}

function marginPercentOf(margin: Prisma.Decimal, revenue: Prisma.Decimal): number {
  return revenue.greaterThan(0) ? margin.div(revenue).mul(100).toNumber() : 0;
}

function buildTopProducts(byProduct: Map<string, ProductAccumulator>): AnalyticsTopProduct[] {
  return [...byProduct.entries()]
    .map(([productId, product]) => {
      const margin = product.revenue.sub(product.cost);
      return {
        productId,
        productName: product.productName,
        quantity: product.quantity.toNumber(),
        revenue: product.revenue.toNumber(),
        cost: product.cost.toNumber(),
        margin: margin.toNumber(),
        marginPercent: marginPercentOf(margin, product.revenue),
      };
    })
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, TOP_PRODUCTS_LIMIT);
}

function buildDailyTrend(byDay: Map<string, Prisma.Decimal>): AnalyticsTrendPoint[] {
  return [...byDay.entries()]
    .map(([date, total]) => ({ date, total: total.toNumber() }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getAnalyticsDashboard(
  prisma: PrismaClient,
  from: Date,
  to: Date,
): Promise<AnalyticsDashboard> {
  const sales = await fetchSalesForPeriod(prisma, from, to);

  let totalRevenue = new Prisma.Decimal(0);
  let totalCost = new Prisma.Decimal(0);
  const byDay = new Map<string, Prisma.Decimal>();
  const byProduct = new Map<string, ProductAccumulator>();

  for (const sale of sales) {
    const netTotal = sale.total.sub(refundedTotalOf(sale));
    totalRevenue = totalRevenue.add(netTotal);

    const dayKey = sale.createdAt.toISOString().slice(0, 10);
    byDay.set(dayKey, (byDay.get(dayKey) ?? new Prisma.Decimal(0)).add(netTotal));

    for (const item of sale.items) {
      const refundedItem = refundedItemsOf(sale, item.id);
      const netQuantity = item.quantity.sub(refundedItem.quantity);
      const netRevenue = item.subtotal.sub(refundedItem.amount);
      const netCost = item.product.cost.mul(netQuantity);
      totalCost = totalCost.add(netCost);

      const product = byProduct.get(item.productId) ?? {
        productName: item.product.name,
        quantity: new Prisma.Decimal(0),
        revenue: new Prisma.Decimal(0),
        cost: new Prisma.Decimal(0),
      };
      product.quantity = product.quantity.add(netQuantity);
      product.revenue = product.revenue.add(netRevenue);
      product.cost = product.cost.add(netCost);
      byProduct.set(item.productId, product);
    }
  }

  const grossMargin = totalRevenue.sub(totalCost);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totalRevenue: totalRevenue.toNumber(),
    totalCost: totalCost.toNumber(),
    grossMargin: grossMargin.toNumber(),
    grossMarginPercent: marginPercentOf(grossMargin, totalRevenue),
    topProducts: buildTopProducts(byProduct),
    dailyTrend: buildDailyTrend(byDay),
  };
}
