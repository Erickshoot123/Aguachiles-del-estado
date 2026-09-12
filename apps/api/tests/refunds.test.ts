import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';
import { createTestProduct, seedBaseFixtures, TEST_PASSWORD, type BaseFixtures } from './fixtures.js';

describe('reembolsos', () => {
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
    await app.inject({
      method: 'POST',
      url: '/api/cash-sessions',
      headers: authHeader(token),
      payload: { cashRegisterId: fixtures.cashRegisterId, openingAmount: 500 },
    });
  });

  afterEach(async () => {
    await resetDatabase();
  });

  async function createAndChargeOrder(quantity: number, price: number): Promise<{ id: string; itemId: string }> {
    const product = await createTestProduct(testPrisma, { price, stock: 20 });
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'delivery', items: [{ productId: product.id, quantity }] },
    });
    const order = orderResponse.json();
    await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/charge`,
      headers: authHeader(token),
      payload: {
        cashRegisterId: fixtures.cashRegisterId,
        payments: [{ paymentMethodId: fixtures.cashPaymentMethodId, amount: price * quantity }],
      },
    });
    return { id: order.id, itemId: order.items[0].id };
  }

  it('un reembolso parcial no toca el stock (nunca se descontó al vender)', async () => {
    const { id: orderId, itemId } = await createAndChargeOrder(4, 100);
    const saleWithItems = await testPrisma.sale.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    const productId = saleWithItems?.items[0]?.productId as string;
    const stockBeforeRefund = await testPrisma.inventory.findUnique({ where: { productId } });

    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/refund`,
      headers: authHeader(token),
      payload: {
        cashRegisterId: fixtures.cashRegisterId,
        reason: 'producto en mal estado',
        items: [{ saleItemId: itemId, quantity: 1 }],
      },
    });

    expect(response.statusCode).toBe(201);
    const stockAfterRefund = await testPrisma.inventory.findUnique({ where: { productId } });
    expect(stockAfterRefund?.quantity.toNumber()).toBe(stockBeforeRefund?.quantity.toNumber() ?? 0);

    const sale = await testPrisma.sale.findUnique({ where: { id: orderId } });
    expect(sale?.status).toBe('partially_refunded');
  });

  it('reembolsar toda la cantidad marca la venta como reembolsada', async () => {
    const { id: orderId, itemId } = await createAndChargeOrder(2, 100);

    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/refund`,
      headers: authHeader(token),
      payload: {
        cashRegisterId: fixtures.cashRegisterId,
        reason: 'pedido no entregado',
        items: [{ saleItemId: itemId, quantity: 2 }],
      },
    });

    expect(response.statusCode).toBe(201);
    const sale = await testPrisma.sale.findUnique({ where: { id: orderId } });
    expect(sale?.status).toBe('refunded');
  });

  it('rechaza reembolsar más cantidad de la que se compró', async () => {
    const { id: orderId, itemId } = await createAndChargeOrder(2, 100);

    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/refund`,
      headers: authHeader(token),
      payload: {
        cashRegisterId: fixtures.cashRegisterId,
        reason: 'intento inválido',
        items: [{ saleItemId: itemId, quantity: 5 }],
      },
    });

    expect(response.statusCode).toBe(409);
    const sale = await testPrisma.sale.findUnique({ where: { id: orderId } });
    expect(sale?.status).toBe('completed');
  });

  it('rechaza reembolsar más cantidad de la que queda tras un reembolso previo', async () => {
    const { id: orderId, itemId } = await createAndChargeOrder(3, 100);

    await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/refund`,
      headers: authHeader(token),
      payload: {
        cashRegisterId: fixtures.cashRegisterId,
        reason: 'primer reembolso',
        items: [{ saleItemId: itemId, quantity: 2 }],
      },
    });

    const secondResponse = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/refund`,
      headers: authHeader(token),
      payload: {
        cashRegisterId: fixtures.cashRegisterId,
        reason: 'segundo reembolso excede lo disponible',
        items: [{ saleItemId: itemId, quantity: 2 }],
      },
    });

    expect(secondResponse.statusCode).toBe(409);
  });

  it('registra un movimiento de caja tipo refund por el monto reembolsado', async () => {
    const { id: orderId, itemId } = await createAndChargeOrder(1, 150);

    await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/refund`,
      headers: authHeader(token),
      payload: {
        cashRegisterId: fixtures.cashRegisterId,
        reason: 'devolución',
        items: [{ saleItemId: itemId, quantity: 1 }],
      },
    });

    const refundMovement = await testPrisma.cashMovement.findFirst({ where: { type: 'refund' } });
    expect(refundMovement?.amount.toNumber()).toBe(150);
  });

  it('un cajero no puede procesar un reembolso', async () => {
    const cajeroToken = await loginAs(app, fixtures.cajeroEmail, TEST_PASSWORD);
    const { id: orderId, itemId } = await createAndChargeOrder(1, 100);

    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/refund`,
      headers: authHeader(cajeroToken),
      payload: {
        cashRegisterId: fixtures.cashRegisterId,
        reason: 'intento no autorizado',
        items: [{ saleItemId: itemId, quantity: 1 }],
      },
    });

    expect(response.statusCode).toBe(403);
  });
});
