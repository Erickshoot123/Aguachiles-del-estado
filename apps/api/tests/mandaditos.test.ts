import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma as db } from './testDb.js';
import { createTestProduct, seedBaseFixtures, type BaseFixtures } from './fixtures.js';
import { plateBusinessDate } from '../src/modules/plates/plateDate.js';
let app: FastifyInstance;
let fixture: BaseFixtures;
let token: string;
let sessionId: string;
let orderId: string;
let transferId: string;
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
  fixture = await seedBaseFixtures(db);
  token = await loginAs(app, fixture.cajeroUsername);
  transferId = (
    await db.paymentMethod.create({ data: { name: 'Transferencia', type: 'transfer' } })
  ).id;
  const product = await createTestProduct(db, { name: 'Aguachile Verde', price: 100 });
  const created = await app.inject({
    method: 'POST',
    url: '/api/orders',
    headers: authHeader(token),
    payload: {
      channel: 'delivery',
      customerPhone: '6670000000',
      deliveryAddress: 'Prueba',
      items: [{ productId: product.id, quantity: 3 }],
    },
  });
  expect(created.statusCode).toBe(201);
  expect(created.json().total).toBe(300);
  orderId = created.json().id;
  const opened = await app.inject({
    method: 'POST',
    url: '/api/cash-sessions',
    headers: authHeader(token),
    payload: { cashRegisterId: fixture.cashRegisterId, openingAmount: 200 },
  });
  expect(opened.statusCode).toBe(201);
  sessionId = opened.json().id;
});
const spend = (amount: number, extra: Record<string, unknown> = {}, id = sessionId) =>
  app.inject({
    method: 'POST',
    url: `/api/cash-sessions/${id}/mandaditos`,
    headers: authHeader(token),
    payload: {
      clientRequestId: randomUUID(),
      amount,
      paymentMethodId: fixture.cashPaymentMethodId,
      ...extra,
    },
  });
async function charge() {
  const result = await app.inject({
    method: 'PATCH',
    url: `/api/orders/${orderId}/charge`,
    headers: authHeader(token),
    payload: {
      cashRegisterId: fixture.cashRegisterId,
      payments: [{ paymentMethodId: fixture.cashPaymentMethodId, amount: 300 }],
    },
  });
  expect(result.statusCode).toBe(200);
}
async function operations() {
  const admin = await loginAs(app, fixture.adminUsername);
  const day = plateBusinessDate();
  return (
    await app.inject({
      method: 'GET',
      url: `/api/analytics/operations?from=${day}&to=${day}`,
      headers: authHeader(admin),
    })
  ).json();
}
it('registra después del cobro, separa caja/transferencia y conserva el gasto en el cierre e historial', async () => {
  await charge();
  expect((await spend(50, { saleId: orderId })).statusCode).toBe(201);
  expect((await spend(100, { saleId: orderId, paymentMethodId: transferId })).statusCode).toBe(201);
  expect((await spend(10)).statusCode).toBe(201);
  const order = await db.sale.findUniqueOrThrow({ where: { id: orderId } });
  expect(order.total.toNumber()).toBe(300);
  const comanda = await app.inject({
    method: 'GET',
    url: `/api/orders/${orderId}/comanda`,
    headers: authHeader(token),
  });
  expect(comanda.json().ticket.total).toBe(300);
  expect(comanda.json().ticket.deliveryFee).toBe(0);
  const list = await app.inject({
    method: 'GET',
    url: `/api/orders/${orderId}/mandaditos`,
    headers: authHeader(token),
  });
  expect(list.json()).toHaveLength(2);
  const current = await app.inject({
    method: 'GET',
    url: `/api/cash-sessions/current?cashRegisterId=${fixture.cashRegisterId}`,
    headers: authHeader(token),
  });
  expect(current.json()).toMatchObject({
    mandaditoTotal: 160,
    mandaditoCashTotal: 60,
    mandaditoTransferTotal: 100,
    expectedClosingAmount: 440,
  });
  const report = await operations();
  expect(report).toMatchObject({
    orders: 1,
    foodSales: 300,
    averageTicket: 300,
    mandaditoTotal: 160,
  });
  expect(report.payments.find((row: { name: string }) => row.name === 'Efectivo')).toMatchObject({
    amount: 300,
    mandaditoExpenses: 60,
    net: 240,
    transactions: 1,
  });
  expect(
    report.payments.find((row: { name: string }) => row.name === 'Transferencia'),
  ).toMatchObject({ amount: 0, mandaditoExpenses: 100, net: -100, transactions: 0 });
  const closed = await app.inject({
    method: 'PATCH',
    url: `/api/cash-sessions/${sessionId}/close`,
    headers: authHeader(token),
    payload: { actualClosingAmount: 440 },
  });
  expect(closed.json()).toMatchObject({
    mandaditoTotal: 160,
    expectedClosingAmount: 440,
    difference: 0,
  });
  const admin = await loginAs(app, fixture.adminUsername);
  const history = await app.inject({
    method: 'GET',
    url: '/api/reports/cash-sessions',
    headers: authHeader(admin),
  });
  expect(history.json()[0]).toMatchObject({
    mandaditoTotal: 160,
    mandaditoCashTotal: 60,
    mandaditoTransferTotal: 100,
  });
});
it('no duplica pagos por reintentos simultáneos y conserva el acuse aunque ya se cerró la caja', async () => {
  const input = { saleId: orderId, clientRequestId: randomUUID() };
  const responses = await Promise.all([spend(50, input), spend(50, input)]);
  expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);
  expect(responses[0]!.json().id).toBe(responses[1]!.json().id);
  expect(await db.cashMovement.count({ where: { category: 'mandadito' } })).toBe(1);
  expect((await spend(100, input)).statusCode).toBe(409);
  await app.inject({
    method: 'PATCH',
    url: `/api/cash-sessions/${sessionId}/close`,
    headers: authHeader(token),
    payload: { actualClosingAmount: 150 },
  });
  expect((await spend(50, input)).statusCode).toBe(201);
  expect((await spend(10)).statusCode).toBe(409);
});
it('contabiliza el gasto en la fecha de pago aunque el pedido se haya cobrado otro día', async () => {
  await charge();
  await db.sale.update({
    where: { id: orderId },
    data: { paidAt: new Date(Date.now() - 3 * 86400000) },
  });
  expect((await spend(50, { saleId: orderId })).statusCode).toBe(201);
  expect(await operations()).toMatchObject({
    foodSales: 0,
    orders: 0,
    mandaditoTotal: 50,
    mandaditoCashTotal: 50,
  });
});
it('rechaza importes inválidos, tarjeta, pedidos inexistentes y movimientos de otra sucursal', async () => {
  for (const amount of [-10, 0, 10.123]) expect((await spend(amount)).statusCode).toBe(400);
  expect((await spend(50, { paymentMethodId: fixture.cardPaymentMethodId })).statusCode).toBe(400);
  expect((await spend(50, { saleId: randomUUID() })).statusCode).toBe(404);
  const location = await db.location.create({ data: { name: 'Otra sucursal' } });
  await db.localNode.create({
    data: { id: 'local', locationId: fixture.locationId, installationId: randomUUID() },
  });
  const foreign = await db.sale.create({
    data: {
      ticketNumber: '#OTRA',
      userId: (await db.user.findUniqueOrThrow({ where: { username: fixture.adminUsername } })).id,
      locationId: location.id,
      channel: 'delivery',
      subtotal: 100,
      taxTotal: 0,
      total: 100,
    },
  });
  expect((await spend(50, { saleId: foreign.id })).statusCode).toBe(403);
  const register = await db.cashRegister.create({
    data: { name: 'Caja ajena', locationId: location.id },
  });
  const foreignSession = await db.cashRegisterSession.create({
    data: { cashRegisterId: register.id, openedByUserId: foreign.userId, openingAmount: 0 },
  });
  expect((await spend(50, {}, foreignSession.id)).statusCode).toBe(403);
  expect(await db.cashMovement.count({ where: { category: 'mandadito' } })).toBe(0);
});
it('el cierre y el egreso concurrentes usan el mismo bloqueo para cuadrar el efectivo', async () => {
  const [expense, closed] = await Promise.all([
    spend(50),
    app.inject({
      method: 'PATCH',
      url: `/api/cash-sessions/${sessionId}/close`,
      headers: authHeader(token),
      payload: { actualClosingAmount: 150 },
    }),
  ]);
  expect(closed.statusCode).toBe(200);
  expect([201, 409]).toContain(expense.statusCode);
  expect(closed.json().expectedClosingAmount).toBe(expense.statusCode === 201 ? 150 : 200);
  expect(closed.json().mandaditoTotal).toBe(expense.statusCode === 201 ? 50 : 0);
});
