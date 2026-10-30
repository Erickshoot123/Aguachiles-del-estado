import { Prisma, type PrismaClient } from '@prisma/client';
import type { CreateOrderRequest, Order } from '@aguachiles/shared';
import { getLocalLocation } from '../locations/localLocation.repository.js';
import { ProductNotAvailableError } from './orders.errors.js';
import { toOrderDto } from './orderDto.js';
import { findRetriedOrder } from './orderIdempotency.repository.js';
import { reservePlates } from '../plates/plateReservation.service.js';

async function priceOrder(tx: Prisma.TransactionClient, input: CreateOrderRequest) {
  const products = await tx.product.findMany({
    where: { id: { in: input.items.map((item) => item.productId) }, isActive: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const items = input.items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) throw new ProductNotAvailableError('desconocido');
    const quantity = new Prisma.Decimal(item.quantity);
    const subtotal = product.price.mul(quantity);
    return { productId: product.id, quantity, unitPrice: product.price,
      taxAmount: subtotal.mul(product.taxRate).div(100), subtotal };
  });
  const subtotal = items.reduce((sum, item) => sum.add(item.subtotal), new Prisma.Decimal(0));
  const taxTotal = items.reduce((sum, item) => sum.add(item.taxAmount), new Prisma.Decimal(0));
  return { items, subtotal, taxTotal, total: subtotal.add(taxTotal) };
}

export async function createOrder(db: PrismaClient, userId: string, input: CreateOrderRequest): Promise<Order> {
  const sale = await db.$transaction(async (tx) => {
    const existing = await findRetriedOrder(tx, userId, input);
    if (existing) return existing;
    const { items, ...totals } = await priceOrder(tx, input);
    const location = await getLocalLocation(tx);
    const allocation = await reservePlates(tx, location.id, input);
    const [sequence] = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('sale_ticket_number_seq')`;
    return tx.sale.create({ data: {
      ticketNumber: `#${sequence.nextval}`, clientRequestId: input.clientRequestId,
      userId, locationId: location.id, channel: input.channel, status: 'pending', fulfillmentStatus: 'in_prep',
      ...totals, customerName: input.customerName ?? null, customerPhone: input.customerPhone ?? null,
      deliveryAddress: input.deliveryAddress ?? null, deliveryReferences: input.deliveryReferences ?? null,
      notes: input.notes ?? null, items: { create: items }, plateAllocation: { create: allocation },
    }, include: { items: { include: { product: true } } } });
  });
  return toOrderDto(sale);
}
