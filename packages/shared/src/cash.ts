import { z } from 'zod';

export const cashSessionStatusSchema = z.enum(['open', 'closed']);
export type CashSessionStatus = z.infer<typeof cashSessionStatusSchema>;

export const openCashSessionRequestSchema = z.object({
  openingAmount: z.number().nonnegative(),
});
export type OpenCashSessionRequest = z.infer<typeof openCashSessionRequestSchema>;

export const closeCashSessionRequestSchema = z.object({
  actualClosingAmount: z.number().nonnegative(),
});
export type CloseCashSessionRequest = z.infer<typeof closeCashSessionRequestSchema>;

export const cashSessionSchema = z.object({
  id: z.string().uuid(),
  cashRegisterName: z.string(),
  status: cashSessionStatusSchema,
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  openingAmount: z.number().nonnegative(),
  expectedClosingAmount: z.number().nonnegative().nullable(),
  actualClosingAmount: z.number().nonnegative().nullable(),
  difference: z.number().nullable(),
});
export type CashSession = z.infer<typeof cashSessionSchema>;
