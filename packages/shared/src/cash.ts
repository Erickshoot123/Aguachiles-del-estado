import { z } from 'zod';

export const cashSessionStatusSchema = z.enum(['open', 'closed']);
export type CashSessionStatus = z.infer<typeof cashSessionStatusSchema>;

export const openCashSessionRequestSchema = z.object({
  cashRegisterId: z.string().uuid(),
  openingAmount: z.number().nonnegative(),
});
export type OpenCashSessionRequest = z.infer<typeof openCashSessionRequestSchema>;

export const closeCashSessionRequestSchema = z.object({
  actualClosingAmount: z.number().nonnegative(),
});
export type CloseCashSessionRequest = z.infer<typeof closeCashSessionRequestSchema>;

export const cashRegisterSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable(),
  isActive: z.boolean(),
});
export type CashRegister = z.infer<typeof cashRegisterSchema>;

export const cashSessionSchema = z.object({
  id: z.string().uuid(),
  cashRegisterId: z.string().uuid(),
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

export const cashMovementTypeSchema = z.enum([
  'sale_income',
  'withdrawal',
  'deposit',
  'expense',
  'refund',
]);
export type CashMovementType = z.infer<typeof cashMovementTypeSchema>;

export const createCashMovementRequestSchema = z.object({
  type: z.enum(['withdrawal', 'deposit']),
  amount: z.number().positive(),
  description: z.string().min(1),
});
export type CreateCashMovementRequest = z.infer<typeof createCashMovementRequestSchema>;

export const cashMovementSchema = z.object({
  id: z.string().uuid(),
  type: cashMovementTypeSchema,
  amount: z.number(),
  description: z.string().nullable(),
  userName: z.string(),
  createdAt: z.string().datetime(),
});
export type CashMovement = z.infer<typeof cashMovementSchema>;
