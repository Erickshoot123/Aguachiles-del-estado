import { z } from 'zod';
import { cashSessionStatusSchema } from './cash.js';
import { saleChannelSchema } from './orders.js';

export const salesReportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;

const salesByDaySchema = z.object({
  date: z.string(),
  total: z.number().nonnegative(),
  count: z.number().nonnegative(),
});

const salesByCashierSchema = z.object({
  userId: z.string().uuid(),
  userName: z.string(),
  total: z.number().nonnegative(),
  count: z.number().nonnegative(),
});

const salesByProductSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  quantity: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

const salesByPaymentMethodSchema = z.object({
  paymentMethodName: z.string(),
  total: z.number().nonnegative(),
});

const salesByChannelSchema = z.object({
  channel: saleChannelSchema,
  total: z.number().nonnegative(),
  count: z.number().nonnegative(),
});

export const salesReportSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  totalSales: z.number().nonnegative(),
  totalTickets: z.number().nonnegative(),
  byDay: z.array(salesByDaySchema),
  byCashier: z.array(salesByCashierSchema),
  byProduct: z.array(salesByProductSchema),
  byPaymentMethod: z.array(salesByPaymentMethodSchema),
  byChannel: z.array(salesByChannelSchema),
});
export type SalesReport = z.infer<typeof salesReportSchema>;

export const cashSessionHistoryItemSchema = z.object({
  id: z.string().uuid(),
  cashRegisterName: z.string(),
  openedByName: z.string(),
  closedByName: z.string().nullable(),
  status: cashSessionStatusSchema,
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  openingAmount: z.number().nonnegative(),
  expectedClosingAmount: z.number().nullable(),
  actualClosingAmount: z.number().nullable(),
  difference: z.number().nullable(),
});
export type CashSessionHistoryItem = z.infer<typeof cashSessionHistoryItemSchema>;

export const cashSessionHistorySchema = z.array(cashSessionHistoryItemSchema);
