import type { Prisma } from '@prisma/client';
import type { Order } from '@aguachiles/shared';

export type SaleWithItems = Prisma.SaleGetPayload<{ include: { items: { include: { product: true } } } }>;

export function toOrderDto(sale: SaleWithItems): Order {
  return {
    id: sale.id,
    ticketNumber: sale.ticketNumber,
    channel: sale.channel,
    fulfillmentStatus: sale.fulfillmentStatus,
    status: sale.status,
    createdAt: sale.createdAt.toISOString(),
    deliveryDueAt: sale.deliveryDueAt?.toISOString() ?? null,
    subtotal: sale.subtotal.toNumber(),
    taxTotal: sale.taxTotal.toNumber(),
    total: sale.total.toNumber(),
    items: sale.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      notes: item.notes,
      productName: item.product.name,
      quantity: item.quantity.toNumber(),
      unitPrice: item.unitPrice.toNumber(),
      subtotal: item.subtotal.toNumber(),
    })),
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    deliveryAddress: sale.deliveryAddress,
    deliveryReferences: sale.deliveryReferences,
    notes: sale.notes,
  };
}

