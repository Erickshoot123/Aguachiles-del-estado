import { z } from 'zod';

export const ticketFormatSchema = z.enum(['thermal_58', 'thermal_80', 'pdf']);

export type TicketFormat = z.infer<typeof ticketFormatSchema>;

export const ticketLineSchema = z.object({
  productName: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
});

export const ticketSchema = z.object({
  saleId: z.string().uuid(),
  ticketNumber: z.string(),
  format: ticketFormatSchema,
  issuedAt: z.string().datetime(),
  businessName: z.string(),
  lines: z.array(ticketLineSchema).min(1),
  subtotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative(),
  discountTotal: z.number().nonnegative(),
  total: z.number().nonnegative(),
  isReprint: z.boolean().default(false),
});

export type Ticket = z.infer<typeof ticketSchema>;
