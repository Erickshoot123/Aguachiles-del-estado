import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testPrisma as db, resetDatabase, disconnectTestDb } from './testDb.js';
import { createTestProduct, seedBaseFixtures, TEST_PASSWORD, type BaseFixtures } from './fixtures.js';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { createOrder, cancelOrder, chargeOrder } from '../src/modules/orders/orders.service.js';
import { openSession } from '../src/modules/cash/cash.service.js';
import { adjustPlates, getPlateAvailability, initializePlates } from '../src/modules/plates/plateDay.service.js';
import { createRefund } from '../src/modules/refunds/refunds.service.js';

describe('disponibilidad diaria de platos', () => {
  let app: FastifyInstance;
  let fixtures: BaseFixtures;
  let userId: string;
  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); await disconnectTestDb(); });
  beforeEach(async () => {
    await resetDatabase();
    fixtures = await seedBaseFixtures(db);
    userId = (await db.user.findUniqueOrThrow({ where: { username: fixtures.adminUsername } })).id;
    await db.plateDay.deleteMany();
  });
  const orderInput = (productId: string, quantity = 1) => ({ channel: 'counter' as const, items: [{ productId, quantity }] });

  it('exige inicio diario, acepta cero y no permite reiniciar para borrar lo reservado', async () => {
    const product = await createTestProduct(db);
    await expect(createOrder(db, userId, orderInput(product.id))).rejects.toThrow('Registra');
    await initializePlates(db, userId, { kilo: 0, halfKilo: 1 });
    await createOrder(db, userId, orderInput(product.id));
    await expect(initializePlates(db, userId, { kilo: 100, halfKilo: 100 })).rejects.toThrow('ya fue registrada');
    expect((await getPlateAvailability(db)).buckets[1]).toMatchObject({ reserved: 1, sold: 0, available: 0 });
  });

  it('comparte platos entre sabores y agrega líneas repetidas antes de validar', async () => {
    const a = await createTestProduct(db, { name: 'Tradicional medio' });
    const b = await createTestProduct(db, { name: 'Colorado medio' });
    await initializePlates(db, userId, { kilo: 0, halfKilo: 2 });
    await expect(createOrder(db, userId, { channel: 'counter', items: [
      { productId: a.id, quantity: 1 }, { productId: b.id, quantity: 1 }, { productId: a.id, quantity: 1 },
    ] })).rejects.toThrow('medio kilo');
    expect(await db.sale.count()).toBe(0);
    expect((await getPlateAvailability(db)).buckets[1]?.available).toBe(2);
    await createOrder(db, userId, { channel: 'counter', items: [
      { productId: a.id, quantity: 1 }, { productId: b.id, quantity: 1 },
    ] });
    expect((await getPlateAvailability(db)).buckets[1]?.available).toBe(0);
  });

  it('separa kilo y medio, y no descuenta extras ni presentaciones sin conteo', async () => {
    const kilo = await createTestProduct(db);
    const extra = await createTestProduct(db);
    const other = await createTestProduct(db);
    await db.product.update({ where: { id: kilo.id }, data: { plateSize: 'kilo' } });
    await db.product.update({ where: { id: extra.id }, data: { isComplement: true } });
    await db.product.update({ where: { id: other.id }, data: { plateSize: null } });
    await initializePlates(db, userId, { kilo: 2, halfKilo: 0 });
    await createOrder(db, userId, { channel: 'counter', items: [
      { productId: kilo.id, quantity: 1 }, { productId: extra.id, quantity: 3 }, { productId: other.id, quantity: 2 },
    ] });
    const stock = await getPlateAvailability(db);
    expect(stock.buckets[0]).toMatchObject({ available: 1, reserved: 1 });
    expect(stock.buckets[1]).toMatchObject({ available: 0, reserved: 0 });
    await expect(createOrder(db, userId, orderInput(kilo.id, 0.5))).rejects.toThrow('enteras');
  });

  it('dos cajas compitiendo por el último plato solo crean un pedido', async () => {
    const product = await createTestProduct(db);
    await initializePlates(db, userId, { kilo: 0, halfKilo: 1 });
    const results = await Promise.allSettled([
      createOrder(db, userId, orderInput(product.id)), createOrder(db, userId, orderInput(product.id)),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.sale.count()).toBe(1);
    expect((await getPlateAvailability(db)).buckets[1]).toMatchObject({ available: 0, reserved: 1 });
  });

  it('un reintento idempotente no reserva dos veces', async () => {
    const product = await createTestProduct(db);
    await initializePlates(db, userId, { kilo: 0, halfKilo: 1 });
    const input = { ...orderInput(product.id), clientRequestId: randomUUID() };
    const [a, b] = await Promise.all([createOrder(db, userId, input), createOrder(db, userId, input)]);
    expect(a.id).toBe(b.id);
    expect(await db.plateAllocation.count()).toBe(1);
    expect((await getPlateAvailability(db)).buckets[1]?.reserved).toBe(1);
  });

  it('cancelar libera una sola vez; cobrar convierte reserva a vendido sin descontar de nuevo', async () => {
    const product = await createTestProduct(db);
    await initializePlates(db, userId, { kilo: 0, halfKilo: 2 });
    const cancelled = await createOrder(db, userId, orderInput(product.id));
    await cancelOrder(db, cancelled.id);
    await expect(cancelOrder(db, cancelled.id)).rejects.toThrow();
    const paid = await createOrder(db, userId, orderInput(product.id));
    const session = await openSession(db, userId, fixtures.cashRegisterId, 0);
    await chargeOrder(db, paid.id, userId, session.id, [{ paymentMethodId: fixtures.cashPaymentMethodId, amount: 100 }]);
    expect((await getPlateAvailability(db)).buckets[1]).toMatchObject({ sold: 1, reserved: 0, available: 1 });
    // Un reembolso devuelve dinero; no vuelve a producir comida.
    await createRefund(db, paid.id, userId, session.id, { cashRegisterId: fixtures.cashRegisterId,
      reason: 'Prueba', items: [{ saleItemId: paid.items[0]!.id, quantity: 1 }] });
    expect((await getPlateAvailability(db)).buckets[1]).toMatchObject({ sold: 1, available: 1 });
  });

  it('un cobro inválido revierte pagos y conserva la reserva', async () => {
    const product = await createTestProduct(db);
    await initializePlates(db, userId, { kilo: 0, halfKilo: 1 });
    const order = await createOrder(db, userId, orderInput(product.id));
    const session = await openSession(db, userId, fixtures.cashRegisterId, 0);
    await expect(chargeOrder(db, order.id, userId, session.id,
      [{ paymentMethodId: fixtures.cashPaymentMethodId, amount: 99 }])).rejects.toThrow();
    expect((await getPlateAvailability(db)).buckets[1]).toMatchObject({ reserved: 1, sold: 0, available: 0 });
  });

  it('ajusta insumo extra con motivo y no permite retirar platos comprometidos', async () => {
    const product = await createTestProduct(db);
    await initializePlates(db, userId, { kilo: 0, halfKilo: 1 });
    await createOrder(db, userId, orderInput(product.id));
    await expect(adjustPlates(db, userId, { kiloDelta: 0, halfKiloDelta: -1, reason: 'Merma' })).rejects.toThrow('quitar');
    await Promise.all([
      adjustPlates(db, userId, { kiloDelta: 0, halfKiloDelta: 2, reason: 'Compra A' }),
      adjustPlates(db, userId, { kiloDelta: 0, halfKiloDelta: 3, reason: 'Compra B' }),
    ]);
    expect((await getPlateAvailability(db)).buckets[1]).toMatchObject({ initial: 1, limit: 6, available: 5 });
    expect(await db.auditLog.count({ where: { action: 'plates.adjust' } })).toBe(2);
  });

  it('el cajero inicia el día, pero solo permisos de catálogo permiten ajustes', async () => {
    const cashier = await loginAs(app, fixtures.cajeroUsername, TEST_PASSWORD);
    const admin = await loginAs(app, fixtures.adminUsername, TEST_PASSWORD);
    const initialized = await app.inject({ method: 'POST', url: '/api/plates/today', headers: authHeader(cashier),
      payload: { kilo: 2, halfKilo: 3 } });
    expect(initialized.statusCode).toBe(200);
    const request = { method: 'PATCH' as const, url: '/api/plates/today', payload: { kiloDelta: 1, halfKiloDelta: 0, reason: 'Insumo' } };
    expect((await app.inject({ ...request, headers: authHeader(cashier) })).statusCode).toBe(403);
    expect((await app.inject({ ...request, headers: authHeader(admin) })).statusCode).toBe(200);
    expect((await app.inject({ ...request, headers: authHeader(admin), payload: { ...request.payload, reason: '' } })).statusCode).toBe(400);
  });

  it('editar la presentación del catálogo no cambia las reservas ya creadas', async () => {
    const product = await createTestProduct(db);
    await initializePlates(db, userId, { kilo: 5, halfKilo: 1 });
    const order = await createOrder(db, userId, orderInput(product.id));
    await db.product.update({ where: { id: product.id }, data: { plateSize: 'kilo' } });
    await cancelOrder(db, order.id);
    const stock = await getPlateAvailability(db);
    expect(stock.buckets[0]?.available).toBe(5);
    expect(stock.buckets[1]?.available).toBe(1);
  });
  it('un acuse perdido al ajustar no duplica la producción habilitada', async () => {
    await initializePlates(db, userId, { kilo: 1, halfKilo: 1 });
    const input = { requestId: randomUUID(), kiloDelta: 2, halfKiloDelta: 3, reason: 'Compra' };
    await Promise.all([adjustPlates(db, userId, input), adjustPlates(db, userId, input)]);
    expect((await getPlateAvailability(db)).buckets.map((bucket) => bucket.limit)).toEqual([3, 4]);
    expect(await db.auditLog.count({ where: { action: 'plates.adjust' } })).toBe(1);
    await expect(adjustPlates(db, userId, { ...input, kiloDelta: 5 })).rejects.toThrow('otros datos');
  });
});
