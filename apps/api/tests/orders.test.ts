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
      payload: { channel: 'delivery', items: [{ productId: product.id, quantity: 2 }] },
    });

    expect(response.statusCode).toBe(201);
    const order = response.json();
    expect(order.subtotal).toBe(200);
    expect(order.taxTotal).toBe(32);
    expect(order.total).toBe(232);
  });

  it('crea un pedido aunque la cantidad exceda el stock registrado (el stock no aplica en este POS)', async () => {
    const product = await createTestProduct(testPrisma, { stock: 2 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'delivery', items: [{ productId: product.id, quantity: 5 }] },
    });

    expect(response.statusCode).toBe(201);
  });

  it('no toca el stock registrado al crear un pedido', async () => {
    const product = await createTestProduct(testPrisma, { stock: 10 });

    await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'delivery', items: [{ productId: product.id, quantity: 4 }] },
    });

    const stock = await testPrisma.inventory.findUnique({ where: { productId: product.id } });
    expect(stock?.quantity.toNumber()).toBe(10);
  });

  it('el precio del pedido no cambia si el producto se actualiza después de crearlo', async () => {
    const product = await createTestProduct(testPrisma, { price: 100, stock: 10 });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'delivery', items: [{ productId: product.id, quantity: 1 }] },
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
      payload: { channel: 'delivery', items: [{ productId: product.id, quantity: 1 }] },
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
      payload: { channel: 'delivery', items: [{ productId: product.id, quantity: 1 }] },
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
      payload: { channel: 'delivery', items: [{ productId: product.id, quantity: 1 }] },
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

  it('cancelar un pedido pendiente no toca el stock (nunca se descontó al crearlo)', async () => {
    const product = await createTestProduct(testPrisma, { stock: 10 });
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'delivery', items: [{ productId: product.id, quantity: 3 }] },
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

  it('un pedido de mostrador pasa de "en preparación" directo a "entregado" (sin recolección ni delivery)', async () => {
    const product = await createTestProduct(testPrisma, { stock: 5 });
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'counter', items: [{ productId: product.id, quantity: 1 }] },
    });
    const order = orderResponse.json();
    expect(order.fulfillmentStatus).toBe('in_prep');

    const advanceResponse = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/advance`,
      headers: authHeader(token),
    });

    expect(advanceResponse.statusCode).toBe(200);
    expect(advanceResponse.json().fulfillmentStatus).toBe('delivered');
  });

  it('un pedido de delivery sí pasa por recolección y delivery antes de entregado', async () => {
    const product = await createTestProduct(testPrisma, { stock: 5 });
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'delivery', items: [{ productId: product.id, quantity: 1 }] },
    });
    const order = orderResponse.json();

    const afterPrep = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/advance`,
      headers: authHeader(token),
    });
    expect(afterPrep.json().fulfillmentStatus).toBe('waiting_pickup');

    const afterPickup = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/advance`,
      headers: authHeader(token),
    });
    expect(afterPickup.json().fulfillmentStatus).toBe('in_delivery');

    const afterDelivery = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/advance`,
      headers: authHeader(token),
    });
    expect(afterDelivery.json().fulfillmentStatus).toBe('delivered');
  });

  it('un pedido de mostrador varado en un estado que ya no existe en su secuencia salta directo a entregado', async () => {
    // Reproduce el caso real del pedido #1018: quedó en "waiting_pickup" de
    // antes de que la secuencia de mostrador se simplificara a
    // ['in_prep', 'delivered']. Ya no hay forma de crear un pedido así hoy,
    // así que se fuerza el estado directo en la base para simular el dato
    // legado, igual que ocurrió en producción.
    const product = await createTestProduct(testPrisma, { stock: 5 });
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'counter', items: [{ productId: product.id, quantity: 1 }] },
    });
    const order = orderResponse.json();
    await testPrisma.sale.update({
      where: { id: order.id },
      data: { fulfillmentStatus: 'waiting_pickup' },
    });

    const advanceResponse = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/advance`,
      headers: authHeader(token),
    });

    expect(advanceResponse.statusCode).toBe(200);
    expect(advanceResponse.json().fulfillmentStatus).toBe('delivered');
  });

  it('no permite avanzar un pedido cancelado aunque su estado no esté en la secuencia de su canal', async () => {
    const product = await createTestProduct(testPrisma, { stock: 5 });
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'counter', items: [{ productId: product.id, quantity: 1 }] },
    });
    const order = orderResponse.json();
    await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/cancel`,
      headers: authHeader(token),
    });

    const advanceResponse = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/advance`,
      headers: authHeader(token),
    });

    expect(advanceResponse.statusCode).toBe(409);
    const sale = await testPrisma.sale.findUniqueOrThrow({ where: { id: order.id } });
    expect(sale.fulfillmentStatus).toBe('cancelled');
  });

  it('no permite avanzar un pedido ya entregado', async () => {
    const product = await createTestProduct(testPrisma, { stock: 5 });
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'counter', items: [{ productId: product.id, quantity: 1 }] },
    });
    const order = orderResponse.json();
    await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/advance`,
      headers: authHeader(token),
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/advance`,
      headers: authHeader(token),
    });

    expect(response.statusCode).toBe(409);
  });
});
