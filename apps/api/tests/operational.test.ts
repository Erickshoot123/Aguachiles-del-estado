import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';
import { createTestProduct, seedBaseFixtures, type BaseFixtures } from './fixtures.js';
import { plateBusinessDate } from '../src/modules/plates/plateDate.js';
let app: FastifyInstance;
let fixture: BaseFixtures;
let token: string;
beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await resetDatabase();
  await app.close();
  await disconnectTestDb();
});
beforeEach(async () => {
  await resetDatabase();
  fixture = await seedBaseFixtures(testPrisma);
  token = await loginAs(app, fixture.adminUsername);
});
it('conserva seis combinaciones, kilos, pagos divididos y devoluciones sin recargos de envío', async () => {
  const product = await createTestProduct(testPrisma, {
    name: 'Aguachile Tradicional',
    price: 100,
  });
  const create = await app.inject({
    method: 'POST',
    url: '/api/orders',
    headers: authHeader(token),
    payload: {
      channel: 'delivery',
      customerPhone: '0000000000',
      deliveryAddress: 'Prueba',
      items: [{ productId: product.id, quantity: 2 }],
    },
  });
  expect(create.statusCode).toBe(201);
  const order = create.json();
  expect(order.total).toBe(200);
  expect(order.deliveryFee).toBe(0);
  await app.inject({
    method: 'POST',
    url: '/api/cash-sessions',
    headers: authHeader(token),
    payload: { cashRegisterId: fixture.cashRegisterId, openingAmount: 0 },
  });
  const charge = await app.inject({
    method: 'PATCH',
    url: `/api/orders/${order.id}/charge`,
    headers: authHeader(token),
    payload: {
      cashRegisterId: fixture.cashRegisterId,
      payments: [
        { paymentMethodId: fixture.cashPaymentMethodId, amount: 100 },
        { paymentMethodId: fixture.cardPaymentMethodId, amount: 100 },
      ],
    },
  });
  expect(charge.statusCode).toBe(200);
  await testPrisma.product.update({
    where: { id: product.id },
    data: { name: 'Aguachile Colorado', plateSize: 'kilo' },
  });
  const day = plateBusinessDate();
  const report = await app.inject({
    method: 'GET',
    url: `/api/analytics/operations?from=${day}&to=${day}`,
    headers: authHeader(token),
  });
  expect(report.statusCode).toBe(200);
  const data = report.json();
  expect(data.orders).toBe(1);
  expect(data.foodSales).toBe(200);
  expect(data.averageTicket).toBe(200);
  expect(data.mandaditoTotal).toBe(0);
  expect(data.mix).toHaveLength(6);
  expect(
    data.mix.find(
      (row: { flavor: string; size: string }) => row.flavor === 'green' && row.size === 'half_kilo',
    ),
  ).toMatchObject({ units: 2, kilos: 1 });
  expect(data.payments.reduce((sum: number, row: { net: number }) => sum + row.net, 0)).toBe(200);
  const receipt = await app.inject({
    method: 'GET',
    url: `/api/orders/${order.id}/receipt`,
    headers: authHeader(token),
  });
  expect(receipt.json().ticket.deliveryFee).toBe(0);
  const refund = await app.inject({
    method: 'POST',
    url: `/api/orders/${order.id}/refund`,
    headers: authHeader(token),
    payload: {
      cashRegisterId: fixture.cashRegisterId,
      reason: 'Prueba devolución',
      items: [{ saleItemId: order.items[0].id, quantity: 1 }],
    },
  });
  expect(refund.statusCode).toBe(201);
  const updated = (
    await app.inject({
      method: 'GET',
      url: `/api/analytics/operations?from=${day}&to=${day}`,
      headers: authHeader(token),
    })
  ).json();
  expect(updated.foodSales).toBe(100);
  expect(updated.averageTicket).toBe(100);
  expect(updated.mandaditoTotal).toBe(0);
  expect(
    updated.mix.find(
      (row: { flavor: string; size: string }) => row.flavor === 'green' && row.size === 'half_kilo',
    ),
  ).toMatchObject({ units: 1, kilos: 0.5 });
  expect(updated.payments.reduce((sum: number, row: { net: number }) => sum + row.net, 0)).toBe(
    100,
  );
});
it('rechaza envío negativo y envío en mostrador', async () => {
  const product = await createTestProduct(testPrisma);
  for (const input of [
    { channel: 'delivery', deliveryFee: -1 },
    { channel: 'delivery', deliveryFee: 50 },
    { channel: 'counter', deliveryFee: 20 },
  ]) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: {
        ...input,
        customerPhone: '0000000000',
        deliveryAddress: 'Prueba',
        items: [{ productId: product.id, quantity: 1 }],
      },
    });
    expect(response.statusCode).toBe(400);
  }
});
