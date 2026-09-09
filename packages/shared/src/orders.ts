import { z } from 'zod';

export const saleChannelSchema = z.enum(['own_app', 'phone', 'whatsapp', 'digital_counter', 'other']);
export type SaleChannel = z.infer<typeof saleChannelSchema>;

export const fulfillmentStatusSchema = z.enum([
  'received',
  'in_prep',
  'waiting_pickup',
  'in_delivery',
  'delivered',
  'cancelled',
]);
export type FulfillmentStatus = z.infer<typeof fulfillmentStatusSchema>;

export const saleStatusSchema = z.enum([
  'pending',
  'completed',
  'cancelled',
  'refunded',
  'partially_refunded',
]);
export type SaleStatus = z.infer<typeof saleStatusSchema>;

export const createOrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
});
export type CreateOrderItem = z.infer<typeof createOrderItemSchema>;

export const createOrderRequestSchema = z.object({
  channel: saleChannelSchema,
  items: z.array(createOrderItemSchema).min(1),
});
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

export const orderItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderSchema = z.object({
  id: z.string().uuid(),
  ticketNumber: z.string(),
  channel: saleChannelSchema,
  fulfillmentStatus: fulfillmentStatusSchema,
  status: saleStatusSchema,
  createdAt: z.string().datetime(),
  items: z.array(orderItemSchema),
  subtotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative(),
  total: z.number().nonnegative(),
});
export type Order = z.infer<typeof orderSchema>;

export const orderListResponseSchema = z.array(orderSchema);
