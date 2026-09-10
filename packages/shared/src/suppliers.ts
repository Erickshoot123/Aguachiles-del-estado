import { z } from 'zod';

export const supplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  contactName: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  taxId: z.string().nullable(),
  isActive: z.boolean(),
});
export type Supplier = z.infer<typeof supplierSchema>;

export const createSupplierRequestSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().min(1).nullable().optional(),
  phone: z.string().min(1).nullable().optional(),
  email: z.string().email().nullable().optional(),
  taxId: z.string().min(1).nullable().optional(),
});
export type CreateSupplierRequest = z.infer<typeof createSupplierRequestSchema>;

export const updateSupplierRequestSchema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().min(1).nullable().optional(),
  phone: z.string().min(1).nullable().optional(),
  email: z.string().email().nullable().optional(),
  taxId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateSupplierRequest = z.infer<typeof updateSupplierRequestSchema>;
