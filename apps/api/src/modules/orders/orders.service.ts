import type { PrismaClient } from '@prisma/client';
import type { Order, FulfillmentStatus, SaleChannel, WhatsAppShare } from '@aguachiles/shared';
import { assertLocalSale, getLocalLocation } from '../locations/localLocation.repository.js';
import { CannotCancelPaidOrderError, InvalidFulfillmentTransitionError, OrderNotFoundError, OrderNotDeliveryError, OrderMissingDeliveryInfoError } from './orders.errors.js';
import { buildWhatsAppMessage } from './whatsapp.js';
import { toOrderDto } from './orderDto.js';
import { deliveryDeadline } from './deliveryCompletion.service.js';
import { settlePlateReservation } from '../plates/plateReservation.service.js';
export { createOrder } from './orderCreation.service.js';
export { chargeOrder } from './orderCharge.service.js';

const ACTIVE_BOARD_STATUSES = ['received', 'in_prep', 'waiting_pickup', 'in_delivery'] as const;

// Un pedido de mostrador lo recoge quien lo pidió apenas está listo: no hay
// "esperando quien lo recoja" ni "en camino" porque el cliente ya está ahí.
// Solo delivery pasa por las cuatro etapas completas.
const FORWARD_SEQUENCE_BY_CHANNEL: Record<SaleChannel, readonly FulfillmentStatus[]> = {
  counter: ['in_prep', 'delivered'],
  delivery: ['in_prep', 'waiting_pickup', 'in_delivery', 'delivered'],
};

export async function listActiveOrders(prisma: PrismaClient): Promise<Order[]> {
  const location = await getLocalLocation(prisma);
  const sales = await prisma.sale.findMany({
    where: { locationId: location.id, fulfillmentStatus: { in: [...ACTIVE_BOARD_STATUSES] } },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return sales.map(toOrderDto);
}

export async function findOrderByTicketNumber(
  prisma: PrismaClient,
  ticketNumber: string,
): Promise<Order> {
  const sale = await prisma.sale.findUnique({
    where: { ticketNumber },
    include: { items: { include: { product: true } } },
  });
  if (!sale) {
    throw new OrderNotFoundError();
  }
  await assertLocalSale(prisma, sale.id);
  return toOrderDto(sale);
}

export async function advanceOrder(prisma: PrismaClient, orderId: string): Promise<Order> {
  await assertLocalSale(prisma, orderId);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sales WHERE id = ${orderId} FOR UPDATE`;
    const sale = await tx.sale.findUnique({ where: { id: orderId } });
    if (!sale) {
      throw new OrderNotFoundError();
    }

    if (sale.fulfillmentStatus === 'cancelled') {
      throw new InvalidFulfillmentTransitionError(sale.fulfillmentStatus);
    }

    const sequence = FORWARD_SEQUENCE_BY_CHANNEL[sale.channel as SaleChannel];
    const currentIndex = sequence.indexOf(sale.fulfillmentStatus as FulfillmentStatus);

    let nextStatus: FulfillmentStatus;
    if (currentIndex === -1) {
      // El pedido quedó en un estado que ya no forma parte de la secuencia
      // de su canal (p. ej. un mostrador varado en "waiting_pickup" de
      // antes de que se simplificara su flujo, como pasó con el pedido
      // #1018). No hay un "siguiente paso" que tenga sentido dentro de la
      // secuencia actual, así que lo llevamos directo al estado final de su
      // canal en vez de bloquear al cajero con un 409 permanente.
      nextStatus = sequence[sequence.length - 1] as FulfillmentStatus;
    } else if (currentIndex === sequence.length - 1) {
      throw new InvalidFulfillmentTransitionError(sale.fulfillmentStatus);
    } else {
      nextStatus = sequence[currentIndex + 1] as FulfillmentStatus;
    }

    return tx.sale.update({
      where: { id: orderId },
      data: { fulfillmentStatus: nextStatus, deliveryDueAt: nextStatus === 'in_delivery' ? deliveryDeadline() : null },
      include: { items: { include: { product: true } } },
    });
  });

  return toOrderDto(updated);
}

export async function cancelOrder(prisma: PrismaClient, orderId: string): Promise<Order> {
  await assertLocalSale(prisma, orderId);
  const order = await prisma.$transaction(async (tx) => {
    await assertLocalSale(tx, orderId);
    await tx.$queryRaw`SELECT id FROM sales WHERE id = ${orderId} FOR UPDATE`;
    const sale = await tx.sale.findUnique({ where: { id: orderId } });
    if (!sale) {
      throw new OrderNotFoundError();
    }
    if (sale.fulfillmentStatus === 'delivered' || sale.fulfillmentStatus === 'cancelled') {
      throw new InvalidFulfillmentTransitionError(sale.fulfillmentStatus);
    }
    if (sale.status !== 'pending') {
      throw new CannotCancelPaidOrderError();
    }
    await settlePlateReservation(tx, orderId, 'released');

    return tx.sale.update({
      where: { id: orderId },
      data: { fulfillmentStatus: 'cancelled', status: 'cancelled' },
      include: { items: { include: { product: true } } },
    });
  });

  return toOrderDto(order);
}

export async function getWhatsAppShareForOrder(
  prisma: PrismaClient,
  orderId: string,
): Promise<WhatsAppShare> {
  await assertLocalSale(prisma, orderId);
  const sale = await prisma.sale.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });
  if (!sale) {
    throw new OrderNotFoundError();
  }
  if (sale.channel !== 'delivery') {
    throw new OrderNotDeliveryError();
  }
  if (!sale.customerName || !sale.customerPhone || !sale.deliveryAddress) {
    throw new OrderMissingDeliveryInfoError();
  }

  return buildWhatsAppMessage({
    ticketNumber: sale.ticketNumber,
    createdAt: sale.createdAt.toISOString(),
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    deliveryAddress: sale.deliveryAddress,
    deliveryReferences: sale.deliveryReferences,
    items: sale.items.map((item) => ({
      productName: item.product.name,
      quantity: item.quantity.toNumber(),
      notes: item.notes,
    })),
    notes: sale.notes,
  });
}
