import type { PrismaClient } from '@prisma/client';
import type { MoveOrderRequest, Order } from '@aguachiles/shared';
import { ConflictError } from '../../lib/errors.js';
import { assertLocalSale } from '../locations/localLocation.repository.js';
import { OrderNotFoundError } from './orders.errors.js';
import { deliveryDeadline } from './deliveryCompletion.service.js';
import { toOrderDto } from './orderDto.js';

export async function moveOrder(db: PrismaClient, id: string, input: MoveOrderRequest): Promise<Order> {
  return db.$transaction(async (tx) => {
    await assertLocalSale(tx, id);
    await tx.$queryRaw`SELECT id FROM sales WHERE id = ${id} FOR UPDATE`;
    const sale = await tx.sale.findUnique({ where: { id }, include: { items: { include: { product: true } } } });
    if (!sale) throw new OrderNotFoundError();
    if (sale.status === 'cancelled' || sale.fulfillmentStatus === 'cancelled' || sale.fulfillmentStatus === 'delivered')
      throw new ConflictError('El pedido ya fue entregado o cancelado. Actualiza el tablero.');
    if (sale.fulfillmentStatus === input.status) return toOrderDto(sale);
    if (sale.fulfillmentStatus !== input.fromStatus)
      throw new ConflictError('El pedido cambió en otra terminal. Actualiza el tablero antes de moverlo.');
    const updated = await tx.sale.update({ where: { id }, data: {
      fulfillmentStatus: input.status,
      deliveryDueAt: input.status === 'in_delivery' && sale.channel === 'delivery' ? deliveryDeadline() : null,
    }, include: { items: { include: { product: true } } } });
    return toOrderDto(updated);
  });
}
