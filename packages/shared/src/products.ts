import { z } from 'zod';

export const productSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  price: z.number().nonnegative(),
  unit: z.string(),
});

export type ProductSummary = z.infer<typeof productSummarySchema>;

export const productListResponseSchema = z.array(productSummarySchema);
