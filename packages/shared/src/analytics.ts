import { z } from 'zod';

export const analyticsTopProductSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  quantity: z.number().nonnegative(),
  revenue: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  margin: z.number(),
  marginPercent: z.number(),
});
export type AnalyticsTopProduct = z.infer<typeof analyticsTopProductSchema>;

export const analyticsTrendPointSchema = z.object({
  date: z.string(),
  total: z.number().nonnegative(),
});
export type AnalyticsTrendPoint = z.infer<typeof analyticsTrendPointSchema>;

export const analyticsDashboardSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  totalRevenue: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
  grossMargin: z.number(),
  grossMarginPercent: z.number(),
  topProducts: z.array(analyticsTopProductSchema),
  dailyTrend: z.array(analyticsTrendPointSchema),
});
export type AnalyticsDashboard = z.infer<typeof analyticsDashboardSchema>;

export const operationalAnalyticsSchema = z.object({
  orders: z.number(),
  foodSales: z.number(),
  mandaditoTotal: z.number(),
  mandaditoCashTotal: z.number(),
  mandaditoTransferTotal: z.number(),
  averageTicket: z.number(),
  mix: z.array(
    z.object({ flavor: z.string(), size: z.string(), units: z.number(), kilos: z.number() }),
  ),
  payments: z.array(
    z.object({
      name: z.string(),
      amount: z.number(),
      refunds: z.number(),
      mandaditoExpenses: z.number(),
      net: z.number(),
      transactions: z.number(),
    }),
  ),
});
export type OperationalAnalytics = z.infer<typeof operationalAnalyticsSchema>;
