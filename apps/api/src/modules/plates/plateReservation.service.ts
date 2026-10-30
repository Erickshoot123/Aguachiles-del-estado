import type { Prisma } from '@prisma/client';
import type { CreateOrderRequest } from '@aguachiles/shared';
import { ConflictError, ValidationError } from '../../lib/errors.js';
import { plateBusinessDate } from './plateDate.js';
import { lockPlateDay } from './plateDay.repository.js';

export async function reservePlates(tx: Prisma.TransactionClient, locationId: string, input: CreateOrderRequest) {
  const date = plateBusinessDate();
  await lockPlateDay(tx, locationId, date);
  const day = await tx.plateDay.findUnique({ where: { locationId_businessDate: { locationId, businessDate: date } } });
  if (!day) throw new ConflictError('Registra cuántos platos de kilo y medio kilo hay hoy antes de crear pedidos.');
  const products = await tx.product.findMany({ where: { id: { in: input.items.map((item) => item.productId) } } });
  const byId = new Map(products.map((product) => [product.id, product]));
  let kilo = 0;
  let halfKilo = 0;
  for (const item of input.items) {
    const product = byId.get(item.productId);
    if (!product?.plateSize || product.isComplement) continue;
    if (!Number.isSafeInteger(item.quantity)) throw new ValidationError('Los platos se venden en cantidades enteras.');
    if (product.plateSize === 'kilo') kilo += item.quantity;
    else halfKilo += item.quantity;
  }
  if (kilo > day.kiloLimit - day.kiloReserved - day.kiloSold) throw new ConflictError('No hay suficientes platos de kilo disponibles.');
  if (halfKilo > day.halfLimit - day.halfReserved - day.halfSold) throw new ConflictError('No hay suficientes platos de medio kilo disponibles.');
  await tx.plateDay.update({ where: { id: day.id }, data: {
    kiloReserved: { increment: kilo }, halfReserved: { increment: halfKilo },
  } });
  return { dayId: day.id, kilo, halfKilo };
}

/** La asignación del pedido fija presentación y jornada aunque después se edite el catálogo. */
export async function settlePlateReservation(tx: Prisma.TransactionClient, saleId: string, state: 'sold' | 'released'): Promise<void> {
  const allocation = await tx.plateAllocation.findUnique({ where: { saleId }, include: { day: true } });
  if (!allocation || allocation.state !== 'reserved') return; // Pedidos anteriores a esta función no tenían reserva.
  await lockPlateDay(tx, allocation.day.locationId, allocation.day.businessDate);
  await tx.plateDay.update({ where: { id: allocation.dayId }, data: {
    kiloReserved: { decrement: allocation.kilo }, halfReserved: { decrement: allocation.halfKilo },
    ...(state === 'sold' ? { kiloSold: { increment: allocation.kilo }, halfSold: { increment: allocation.halfKilo } } : {}),
  } });
  await tx.plateAllocation.update({ where: { saleId }, data: { state } });
}
