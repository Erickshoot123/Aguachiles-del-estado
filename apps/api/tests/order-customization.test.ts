import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';
import { createTestProduct, DELIVERY_ORDER_INFO, seedBaseFixtures, type BaseFixtures } from './fixtures.js';
import { completeDueDeliveries, deliveryDeadline } from '../src/modules/orders/deliveryCompletion.service.js';

describe('personalización por porción y entrega automática', () => {
  let app: FastifyInstance;
  let fixtures: BaseFixtures;
  let token: string;
  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await resetDatabase(); await app.close(); await disconnectTestDb(); });
  beforeEach(async () => {
    await resetDatabase(); fixtures = await seedBaseFixtures(testPrisma);
    token = await loginAs(app, fixtures.adminUsername);
  });
  const create = async (items: Array<{ productId: string; quantity: number; notes?: string }>, clientRequestId = randomUUID()) => {
    const result = await app.inject({ method: 'POST', url: '/api/orders', headers: authHeader(token),
      payload: { channel: 'delivery', ...DELIVERY_ORDER_INFO, clientRequestId, items } });
    expect(result.statusCode).toBe(201);
    return result.json();
  };
  const advance = async (id: string) => {
    const response = await app.inject({ method: 'PATCH', url: `/api/orders/${id}/advance`, headers: authHeader(token) });
    expect(response.statusCode).toBe(200);
    return response.json();
  };
  it('guarda dos porciones distintas del mismo producto, las reimprime y distingue reintentos modificados', async () => {
    const product = await createTestProduct(testPrisma);
    const clientRequestId = randomUUID();
    const items = [{ productId: product.id, quantity: 1, notes: 'Sin cebolla · Sin ajo' },
      { productId: product.id, quantity: 1, notes: 'Extra sal · Extra picante' }];
    const order = await create(items, clientRequestId);
    expect(order.items.map((item: { notes: string }) => item.notes).sort()).toEqual(items.map((item) => item.notes).sort());
    const retry = await create([...items].reverse(), clientRequestId);
    expect(retry.id).toBe(order.id);
    const changed = await app.inject({ method: 'POST', url: '/api/orders', headers: authHeader(token),
      payload: { channel: 'delivery', ...DELIVERY_ORDER_INFO, clientRequestId,
        items: [items[0], { ...items[1], notes: 'Sin pimienta' }] } });
    expect(changed.statusCode).toBe(409);
    const kitchen = await app.inject({ method: 'GET', url: `/api/orders/${order.id}/comanda`, headers: authHeader(token) });
    expect(kitchen.statusCode).toBe(200);
    expect(kitchen.json().ticket.lines.map((line: { notes: string }) => line.notes).sort()).toEqual(items.map((item) => item.notes).sort());
    expect((await testPrisma.plateAllocation.findUniqueOrThrow({ where: { saleId: order.id } })).halfKilo).toBe(2);
  });
  it('inicia los 25 minutos al salir a reparto y conserva el plazo después de cobrar o recargar', async () => {
    const product = await createTestProduct(testPrisma);
    const order = await create([{ productId: product.id, quantity: 1 }]);
    expect(order.deliveryDueAt).toBeNull();
    expect((await advance(order.id)).deliveryDueAt).toBeNull();
    const before = Date.now();
    const inDelivery = await advance(order.id);
    expect(inDelivery.fulfillmentStatus).toBe('in_delivery');
    const deadline = new Date(inDelivery.deliveryDueAt);
    expect(deadline.getTime()).toBeGreaterThanOrEqual(before + 25 * 60000);
    expect(deadline.getTime()).toBeLessThanOrEqual(Date.now() + 25 * 60000);
    // Cambiar updatedAt (p.ej. al cobrar) no reinicia el temporizador persistido.
    await testPrisma.sale.update({ where: { id: order.id }, data: { notes: 'Llamar al llegar' } });
    expect(await completeDueDeliveries(testPrisma, new Date(deadline.getTime() - 1))).toBe(0);
    expect(await completeDueDeliveries(testPrisma, deadline)).toBe(1);
    expect(await completeDueDeliveries(testPrisma, deadline)).toBe(0);
    const delivered = await testPrisma.sale.findUniqueOrThrow({ where: { id: order.id } });
    expect(delivered.fulfillmentStatus).toBe('delivered');
    expect(delivered.status).toBe('pending');
    expect(await testPrisma.salePayment.count()).toBe(0);
    const lookup = await app.inject({ method: 'GET', url: `/api/orders/lookup?ticketNumber=${encodeURIComponent(order.ticketNumber)}`, headers: authHeader(token) });
    expect(lookup.json().fulfillmentStatus).toBe('delivered');
  });
  it('solo entrega pedidos locales que siguen en reparto y no cambia cancelados ni pedidos en preparación', async () => {
    const product = await createTestProduct(testPrisma);
    const preparing = await create([{ productId: product.id, quantity: 1 }]);
    const cancelled = await create([{ productId: product.id, quantity: 1 }]);
    const foreign = await create([{ productId: product.id, quantity: 1 }]);
    await testPrisma.localNode.create({ data: { id: 'local', locationId: fixtures.locationId, installationId: randomUUID() } });
    const other = await testPrisma.location.create({ data: { name: 'Otra sucursal' } });
    const expired = new Date(Date.now() - 1000);
    await testPrisma.sale.update({ where: { id: preparing.id }, data: { deliveryDueAt: expired } });
    await testPrisma.sale.update({ where: { id: cancelled.id }, data: { fulfillmentStatus: 'in_delivery', status: 'cancelled', deliveryDueAt: expired } });
    await testPrisma.sale.update({ where: { id: foreign.id }, data: { locationId: other.id, fulfillmentStatus: 'in_delivery', deliveryDueAt: expired } });
    expect(await completeDueDeliveries(testPrisma)).toBe(0);
    expect(deliveryDeadline(new Date(0)).getTime()).toBe(25 * 60000);
  });
});
