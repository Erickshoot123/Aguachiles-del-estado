import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';
import { createTestProduct, seedBaseFixtures, TEST_PASSWORD, type BaseFixtures } from './fixtures.js';

describe('orders', () => {
  let app: FastifyInstance;
  let fixtures: BaseFixtures;
  let token: string;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await resetDatabase();
    fixtures = await seedBaseFixtures(testPrisma);
    token = await loginAs(app, fixtures.adminEmail, TEST_PASSWORD);
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it('calcula el subtotal, impuesto y total correctamente al crear un pedido', async () => {
    const product = await createTestProduct(testPrisma, { price: 100, cost: 50, stock: 10 });
    await testPrisma.product.update({ where: { id: product.id }, data: { taxRate: 16 } });

    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'phone', items: [{ productId: product.id, quantity: 2 }] },
    });

    expect(response.statusCode).toBe(201);
    const order = response.json();
    expect(order.subtotal).toBe(200);
    expect(order.taxTotal).toBe(32);
    expect(order.total).toBe(232);
  });

  it('rechaza un pedido cuando la cantidad pedida excede el stock disponible', async () => {
    const product = await createTestProduct(testPrisma, { stock: 2 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'phone', items: [{ productId: product.id, quantity: 3 }] },
    });

    expect(response.statusCode).toBe(409);
    const stock = await testPrisma.inventory.findUnique({ where: { productId: product.id } });
    expect(stock?.quantity.toNumber()).toBe(2);
  });

  it('descuenta el stock correctamente al crear un pedido', async () => {
    const product = await createTestProduct(testPrisma, { stock: 10 });

    await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'phone', items: [{ productId: product.id, quantity: 4 }] },
    });

    const stock = await testPrisma.inventory.findUnique({ where: { productId: product.id } });
    expect(stock?.quantity.toNumber()).toBe(6);
  });

  it('el precio del pedido no cambia si el producto se actualiza después de crearlo', async () => {
    const product = await createTestProduct(testPrisma, { price: 100, stock: 10 });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'phone', items: [{ productId: product.id, quantity: 1 }] },
    });
    const order = createResponse.json();

    await app.inject({
      method: 'PATCH',
      url: `/api/products/${product.id}`,
      headers: authHeader(token),
      payload: { price: 500 },
    });

    expect(order.items[0].unitPrice).toBe(100);
    expect(order.total).toBe(100);
  });

  async function openCashSession(): Promise<void> {
    await app.inject({
      method: 'POST',
      url: '/api/cash-sessions',
      headers: authHeader(token),
      payload: { cashRegisterId: fixtures.cashRegisterId, openingAmount: 500 },
    });
  }

  it('rechaza un cobro cuyos pagos no suman el total del pedido', async () => {
    const product = await createTestProduct(testPrisma, { price: 100, stock: 5 });
    await openCashSession();
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'phone', items: [{ productId: product.id, quantity: 1 }] },
    });
    const order = orderResponse.json();

    const chargeResponse = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/charge`,
      headers: authHeader(token),
      payload: {
        cashRegisterId: fixtures.cashRegisterId,
        payments: [{ paymentMethodId: fixtures.cashPaymentMethodId, amount: 60 }],
      },
    });

    expect(chargeResponse.statusCode).toBe(400);
    const refreshedOrder = await testPrisma.sale.findUnique({ where: { id: order.id } });
    expect(refreshedOrder?.status).toBe('pending');
  });

  it('acepta un cobro dividido entre dos métodos de pago que sí suman el total', async () => {
    const product = await createTestProduct(testPrisma, { price: 100, stock: 5 });
    await openCashSession();
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'phone', items: [{ productId: product.id, quantity: 1 }] },
    });
    const order = orderResponse.json();

    const chargeResponse = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/charge`,
      headers: authHeader(token),
      payload: {
        cashRegisterId: fixtures.cashRegisterId,
        payments: [
          { paymentMethodId: fixtures.cashPaymentMethodId, amount: 60 },
          { paymentMethodId: fixtures.cardPaymentMethodId, amount: 40 },
        ],
      },
    });

    expect(chargeResponse.statusCode).toBe(200);
    const payments = await testPrisma.salePayment.findMany({ where: { saleId: order.id } });
    expect(payments).toHaveLength(2);
  });

  it('no permite cancelar un pedido que ya fue cobrado', async () => {
    const product = await createTestProduct(testPrisma, { price: 100, stock: 5 });
    await openCashSession();
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'phone', items: [{ productId: product.id, quantity: 1 }] },
    });
    const order = orderResponse.json();
    await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/charge`,
      headers: authHeader(token),
      payload: {
        cashRegisterId: fixtures.cashRegisterId,
        payments: [{ paymentMethodId: fixtures.cashPaymentMethodId, amount: 100 }],
      },
    });

    const cancelResponse = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/cancel`,
      headers: authHeader(token),
    });

    expect(cancelResponse.statusCode).toBe(409);
  });

  it('cancelar un pedido pendiente repone el stock', async () => {
    const product = await createTestProduct(testPrisma, { stock: 10 });
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'phone', items: [{ productId: product.id, quantity: 3 }] },
    });
    const order = orderResponse.json();

    const cancelResponse = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/cancel`,
      headers: authHeader(token),
    });

    expect(cancelResponse.statusCode).toBe(200);
    const stock = await testPrisma.inventory.findUnique({ where: { productId: product.id } });
    expect(stock?.quantity.toNumber()).toBe(10);
  });
});
