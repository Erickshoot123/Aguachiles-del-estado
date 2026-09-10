import { z } from 'zod';

export const paymentMethodTypeSchema = z.enum(['cash', 'card', 'transfer', 'other']);
export type PaymentMethodType = z.infer<typeof paymentMethodTypeSchema>;

export const paymentMethodSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: paymentMethodTypeSchema,
});
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
