import type { Prisma } from '@prisma/client';
import type { CreateOrderRequest } from '@aguachiles/shared';
import { ConflictError } from '../../lib/errors.js';
import { assertLocalSale } from '../locations/localLocation.repository.js';
import type { SaleWithItems } from './orderDto.js';

function matchesRequest(sale: SaleWithItems, userId: string, input: CreateOrderRequest): boolean {
  const requestItems = input.items.map((item) => JSON.stringify([item.productId, String(item.quantity), item.notes ?? null])).sort();
  const storedItems = sale.items.map((item) => JSON.stringify([item.productId, item.quantity.toString(), item.notes])).sort();
  const sameItems = JSON.stringify(requestItems) === JSON.stringify(storedItems);
  return sameItems && sale.userId === userId && sale.channel === input.channel &&
    sale.customerName === (input.customerName ?? null) && sale.customerPhone === (input.customerPhone ?? null) &&
    sale.deliveryAddress === (input.deliveryAddress ?? null) &&
    sale.deliveryReferences === (input.deliveryReferences ?? null) && sale.notes === (input.notes ?? null);
}

export async function findRetriedOrder(tx: Prisma.TransactionClient, userId: string, input: CreateOrderRequest) {
  if (!input.clientRequestId) return null;
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${input.clientRequestId}, 0))`;
  const existing = await tx.sale.findUnique({ where: { clientRequestId: input.clientRequestId },
    include: { items: { include: { product: true } } } });
  if (existing) {
    await assertLocalSale(tx, existing.id);
    if (!matchesRequest(existing, userId, input)) {
      throw new ConflictError('La solicitud ya fue utilizada con otros datos o usuario');
    }
  }
  return existing;
}
