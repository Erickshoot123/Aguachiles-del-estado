import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';
import { createTestProduct, DELIVERY_ORDER_INFO, seedBaseFixtures, type BaseFixtures } from './fixtures.js';

describe('tablero y nombre opcional', () => {
  let app: FastifyInstance; let fixtures: BaseFixtures; let token: string;
  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await resetDatabase(); await app.close(); await disconnectTestDb(); });
  beforeEach(async () => { await resetDatabase(); fixtures = await seedBaseFixtures(testPrisma); token = await loginAs(app, fixtures.adminUsername); });
  async function create() {
    const product = await createTestProduct(testPrisma);
    const response = await app.inject({ method: 'POST', url: '/api/orders', headers: authHeader(token), payload: {
      channel: 'delivery', customerName: '   ', customerPhone: DELIVERY_ORDER_INFO.customerPhone,
      deliveryAddress: DELIVERY_ORDER_INFO.deliveryAddress, items: [{ productId: product.id, quantity: 1 }],
    } });
    expect(response.statusCode).toBe(201); return response.json();
  }
  const move = (id: string, fromStatus: string, status: string) => app.inject({ method: 'PATCH', url: `/api/orders/${id}/move`,
    headers: authHeader(token), payload: { fromStatus, status } });
  it('crea delivery sin nombre y permite consultar comanda y WhatsApp sin perder teléfono o dirección', async () => {
    const order = await create(); expect(order.customerName).toBeNull();
    const kitchen = await app.inject({ method: 'GET', url: `/api/orders/${order.id}/comanda`, headers: authHeader(token) });
    expect(kitchen.statusCode).toBe(200); expect(kitchen.json().ticket.customerPhone).toBe(DELIVERY_ORDER_INFO.customerPhone);
    const share = await app.inject({ method: 'GET', url: `/api/orders/${order.id}/whatsapp`, headers: authHeader(token) });
    expect(share.statusCode).toBe(200); expect(share.json().message).toContain(DELIVERY_ORDER_INFO.deliveryAddress);
  });
  it('mueve hacia delante y atrás, conserva el plazo al repetir y no registra pagos', async () => {
    const order = await create();
    expect((await move(order.id, 'in_prep', 'waiting_pickup')).statusCode).toBe(200);
    const sent = await move(order.id, 'waiting_pickup', 'in_delivery'); expect(sent.statusCode).toBe(200);
    const due = sent.json().deliveryDueAt; expect(Date.parse(due)).toBeGreaterThan(Date.now() + 24 * 60000);
    const retry = await move(order.id, 'waiting_pickup', 'in_delivery'); expect(retry.json().deliveryDueAt).toBe(due);
    expect((await move(order.id, 'in_delivery', 'in_prep')).json().deliveryDueAt).toBeNull();
    const stored = await testPrisma.sale.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.fulfillmentStatus).toBe('in_prep'); expect(stored.status).toBe('pending');
    expect(await testPrisma.salePayment.count()).toBe(0);
  });
  it('rechaza estados obsoletos y no vuelve a abrir pedidos entregados', async () => {
    const order = await create(); await move(order.id, 'in_prep', 'in_delivery');
    expect((await move(order.id, 'in_prep', 'waiting_pickup')).statusCode).toBe(409);
    await testPrisma.sale.update({ where: { id: order.id }, data: { fulfillmentStatus: 'delivered' } });
    expect((await move(order.id, 'in_delivery', 'in_prep')).statusCode).toBe(409);
    expect((await move(order.id, 'in_prep', 'delivered')).statusCode).toBe(400);
  });
  it('aísla la sucursal local y exige autenticación', async () => {
    const order = await create();
    const noAuth = await app.inject({ method: 'PATCH', url: `/api/orders/${order.id}/move`, payload: { fromStatus: 'in_prep', status: 'in_delivery' } });
    expect(noAuth.statusCode).toBe(401);
    await testPrisma.localNode.create({ data: { id: 'local', locationId: fixtures.locationId, installationId: randomUUID() } });
    const location = await testPrisma.location.create({ data: { name: 'Otra sucursal' } });
    await testPrisma.sale.update({ where: { id: order.id }, data: { locationId: location.id } });
    expect((await move(order.id, 'in_prep', 'in_delivery')).statusCode).toBe(403);
  });
});
