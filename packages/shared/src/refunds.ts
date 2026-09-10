import { z } from 'zod';
import { saleStatusSchema } from './orders.js';

const refundableItemSchema = z.object({
  saleItemId: z.string().uuid(),
  productName: z.string(),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().positive(),
  refundedQuantity: z.number().nonnegative(),
  refundableQuantity: z.number().nonnegative(),
});
export type RefundableItem = z.infer<typeof refundableItemSchema>;

export const refundableSaleSchema = z.object({
  saleId: z.string().uuid(),
  ticketNumber: z.string(),
  status: saleStatusSchema,
  items: z.array(refundableItemSchema),
});
export type RefundableSale = z.infer<typeof refundableSaleSchema>;

const createRefundItemSchema = z.object({
  saleItemId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const createRefundRequestSchema = z.object({
  cashRegisterId: z.string().uuid(),
  reason: z.string().min(1),
  items: z.array(createRefundItemSchema).min(1),
});
export type CreateRefundRequest = z.infer<typeof createRefundRequestSchema>;

export const refundResultSchema = z.object({
  id: z.string().uuid(),
  saleId: z.string().uuid(),
  totalRefunded: z.number().nonnegative(),
});
export type RefundResult = z.infer<typeof refundResultSchema>;
