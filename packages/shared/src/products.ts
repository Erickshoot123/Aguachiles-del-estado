import { z } from 'zod';

export const productSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  price: z.number().nonnegative(),
  unit: z.string(),
});

export type ProductSummary = z.infer<typeof productSummarySchema>;

export const productListResponseSchema = z.array(productSummarySchema);

export const productSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  barcode: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  taxRate: z.number().nonnegative(),
  unit: z.string(),
  isActive: z.boolean(),
  stock: z.number().nonnegative(),
});
export type Product = z.infer<typeof productSchema>;

export const createProductRequestSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
  categoryId: z.string().uuid(),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  taxRate: z.number().nonnegative().default(0),
  unit: z.string().min(1),
  initialStock: z.number().nonnegative().default(0),
});
export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;

export const updateProductRequestSchema = z.object({
  sku: z.string().min(1).optional(),
  barcode: z.string().min(1).nullable().optional(),
  name: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  categoryId: z.string().uuid().optional(),
  price: z.number().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
  taxRate: z.number().nonnegative().optional(),
  unit: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>;

export const inventoryAdjustmentTypeSchema = z.enum(['adjustment_in', 'adjustment_out']);
export type InventoryAdjustmentType = z.infer<typeof inventoryAdjustmentTypeSchema>;

export const createInventoryAdjustmentRequestSchema = z.object({
  type: inventoryAdjustmentTypeSchema,
  quantity: z.number().positive(),
  reason: z.string().min(1, 'La razón del ajuste es obligatoria'),
});
export type CreateInventoryAdjustmentRequest = z.infer<typeof createInventoryAdjustmentRequestSchema>;

export const inventoryAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  type: inventoryAdjustmentTypeSchema,
  quantity: z.number().positive(),
  previousStock: z.number().nonnegative(),
  newStock: z.number().nonnegative(),
  reason: z.string(),
});
export type InventoryAdjustment = z.infer<typeof inventoryAdjustmentSchema>;
