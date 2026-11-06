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
  mandaditoTotal: z.number().optional(),
  mandaditoCashTotal: z.number().optional(),
  mandaditoTransferTotal: z.number().optional(),
  id: z.string().uuid(),
  cashRegisterId: z.string().uuid(),
  cashRegisterName: z.string(),
  status: cashSessionStatusSchema,
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  openingAmount: z.number().nonnegative(),
  expectedClosingAmount: z.number().nullable(),
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
  category: z.string().nullable().optional(),
  paymentMethodName: z.string().nullable().optional(),
  id: z.string().uuid(),
  type: cashMovementTypeSchema,
  amount: z.number(),
  description: z.string().nullable(),
  userName: z.string(),
  createdAt: z.string().datetime(),
});
export type CashMovement = z.infer<typeof cashMovementSchema>;

export const createMandaditoRequestSchema = z.object({
  clientRequestId: z.string().uuid(),
  saleId: z.string().uuid().optional(),
  paymentMethodId: z.string().uuid(),
  amount: z
    .number()
    .positive()
    .max(100000)
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
      'Usa como máximo dos decimales',
    ),
  description: z.string().trim().max(300).optional(),
});
export type CreateMandaditoRequest = z.infer<typeof createMandaditoRequestSchema>;
export interface MandaditoExpense {
  id: string;
  amount: number;
  description: string | null;
  saleId: string | null;
  paymentMethodName: string;
  userName: string;
  createdAt: string;
}
