import { z } from 'zod';

const purchaseItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const createPurchaseRequestSchema = z.object({
  supplierId: z.string().uuid(),
  reason: z.string().min(1).optional(),
  items: z.array(purchaseItemSchema).min(1),
});
export type CreatePurchaseRequest = z.infer<typeof createPurchaseRequestSchema>;

const purchaseLineSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  quantity: z.number(),
  newStock: z.number(),
});
export type PurchaseLine = z.infer<typeof purchaseLineSchema>;

export const purchaseSchema = z.object({
  id: z.string().uuid(),
  supplierId: z.string().uuid(),
  supplierName: z.string(),
  createdAt: z.string().datetime(),
  lines: z.array(purchaseLineSchema),
});
export type Purchase = z.infer<typeof purchaseSchema>;
