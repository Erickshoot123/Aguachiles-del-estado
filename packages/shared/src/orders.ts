import { z } from 'zod';

export const saleChannelSchema = z.enum(['counter', 'delivery']);
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

// Solo tienen sentido (y solo se piden) para channel = 'delivery'. No
// participan en subtotal/total/pagos: son datos de logística de entrega
// (quién, dónde, qué), capturados al crear el pedido para armar el mensaje
// de WhatsApp del repartidor y, opcionalmente, el QR impreso en el ticket.
// A propósito no incluye nada de montos (costo de envío, "paga con") — el
// negocio no quiere esa información en el mensaje.
const deliveryInfoFieldsSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().min(1).optional(),
  deliveryAddress: z.string().min(1).optional(),
  deliveryReferences: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
});

export const createOrderRequestSchema = z
  .object({
    channel: saleChannelSchema,
    items: z.array(createOrderItemSchema).min(1),
  })
  .merge(deliveryInfoFieldsSchema)
  .superRefine((data, ctx) => {
    if (data.channel !== 'delivery') return;
    if (!data.customerName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El nombre del cliente es obligatorio para pedidos de delivery',
        path: ['customerName'],
      });
    }
    if (!data.customerPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El teléfono del cliente es obligatorio para pedidos de delivery',
        path: ['customerPhone'],
      });
    }
    if (!data.deliveryAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La dirección de entrega es obligatoria para pedidos de delivery',
        path: ['deliveryAddress'],
      });
    }
  });
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

const chargePaymentSchema = z.object({
  paymentMethodId: z.string().uuid(),
  amount: z.number().positive(),
  reference: z.string().min(1).optional(),
});
export type ChargePayment = z.infer<typeof chargePaymentSchema>;

export const chargeOrderRequestSchema = z.object({
  cashRegisterId: z.string().uuid(),
  payments: z.array(chargePaymentSchema).min(1),
});
export type ChargeOrderRequest = z.infer<typeof chargeOrderRequestSchema>;

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
  customerName: z.string().nullable(),
  customerPhone: z.string().nullable(),
  deliveryAddress: z.string().nullable(),
  deliveryReferences: z.string().nullable(),
  notes: z.string().nullable(),
});
export type Order = z.infer<typeof orderSchema>;

export const orderListResponseSchema = z.array(orderSchema);

/** Mensaje y liga wa.me listos para compartir el pedido delivery por WhatsApp. */
export const whatsAppShareSchema = z.object({
  message: z.string(),
  url: z.string().url(),
  // Si el mensaje no cupo completo (~900 caracteres de URL) y se tuvieron
  // que recortar las notas para que el QR siga siendo legible/escaneable.
  truncated: z.boolean(),
});
export type WhatsAppShare = z.infer<typeof whatsAppShareSchema>;
