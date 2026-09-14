import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';
import {
  createTestProduct,
  DELIVERY_ORDER_INFO,
  seedBaseFixtures,
  TEST_PASSWORD,
  type BaseFixtures,
} from './fixtures.js';

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
      payload: { channel: 'delivery', ...DELIVERY_ORDER_INFO, items: [{ productId: product.id, quantity: 2 }] },
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
      payload: { channel: 'delivery', ...DELIVERY_ORDER_INFO, items: [{ productId: product.id, quantity: 5 }] },
    });

    expect(response.statusCode).toBe(201);
  });

  it('no toca el stock registrado al crear un pedido', async () => {
    const product = await createTestProduct(testPrisma, { stock: 10 });

    await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'delivery', ...DELIVERY_ORDER_INFO, items: [{ productId: product.id, quantity: 4 }] },
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
      payload: { channel: 'delivery', ...DELIVERY_ORDER_INFO, items: [{ productId: product.id, quantity: 1 }] },
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
      payload: { channel: 'delivery', ...DELIVERY_ORDER_INFO, items: [{ productId: product.id, quantity: 1 }] },
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
      payload: { channel: 'delivery', ...DELIVERY_ORDER_INFO, items: [{ productId: product.id, quantity: 1 }] },
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
      payload: { channel: 'delivery', ...DELIVERY_ORDER_INFO, items: [{ productId: product.id, quantity: 1 }] },
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
      payload: { channel: 'delivery', ...DELIVERY_ORDER_INFO, items: [{ productId: product.id, quantity: 3 }] },
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
      payload: { channel: 'delivery', ...DELIVERY_ORDER_INFO, items: [{ productId: product.id, quantity: 1 }] },
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

  describe('datos de entrega para delivery', () => {
    it('rechaza un pedido delivery sin nombre, teléfono o dirección del cliente', async () => {
      const product = await createTestProduct(testPrisma, { stock: 5 });

      const response = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(token),
        payload: { channel: 'delivery', items: [{ productId: product.id, quantity: 1 }] },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      const paths = (body.issues as { path: string[] }[]).map((issue) => issue.path[0]);
      expect(paths).toEqual(
        expect.arrayContaining(['customerName', 'customerPhone', 'deliveryAddress']),
      );
    });

    it('no exige datos de cliente para un pedido de mostrador', async () => {
      const product = await createTestProduct(testPrisma, { stock: 5 });

      const response = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(token),
        payload: { channel: 'counter', items: [{ productId: product.id, quantity: 1 }] },
      });

      expect(response.statusCode).toBe(201);
    });

    it('guarda y expone los datos de entrega de un pedido delivery', async () => {
      const product = await createTestProduct(testPrisma, { stock: 5 });

      const response = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(token),
        payload: {
          channel: 'delivery',
          items: [{ productId: product.id, quantity: 1 }],
          customerName: 'María Muñoz',
          customerPhone: '5512345678',
          deliveryAddress: 'Av. Insurgentes 100',
          deliveryReferences: 'Portón negro',
          notes: 'Sin cebolla',
        },
      });

      expect(response.statusCode).toBe(201);
      const order = response.json();
      expect(order.customerName).toBe('María Muñoz');
      expect(order.customerPhone).toBe('5512345678');
      expect(order.deliveryAddress).toBe('Av. Insurgentes 100');
      expect(order.deliveryReferences).toBe('Portón negro');
      expect(order.notes).toBe('Sin cebolla');
    });

    it('un pedido de mostrador no guarda datos de entrega aunque el schema los acepte', async () => {
      const product = await createTestProduct(testPrisma, { stock: 5 });

      const response = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(token),
        payload: { channel: 'counter', items: [{ productId: product.id, quantity: 1 }] },
      });

      const order = response.json();
      expect(order.customerName).toBeNull();
      expect(order.deliveryAddress).toBeNull();
    });
  });

  describe('GET /api/orders/:id/whatsapp', () => {
    async function createDeliveryOrder(
      overrides: Record<string, unknown> = {},
    ): Promise<{ id: string }> {
      const product = await createTestProduct(testPrisma, { price: 100, stock: 5 });
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(token),
        payload: {
          channel: 'delivery',
          items: [{ productId: product.id, quantity: 2 }],
          ...DELIVERY_ORDER_INFO,
          ...overrides,
        },
      });
      return response.json();
    }

    it('arma el mensaje de WhatsApp de un pedido delivery recién creado (sin cobrar aún)', async () => {
      const order = await createDeliveryOrder();

      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${order.id}/whatsapp`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const share = response.json();
      expect(share.url).toMatch(/^https:\/\/wa\.me\/\?text=/);
      expect(share.message).toContain(DELIVERY_ORDER_INFO.customerName);
      expect(share.message).not.toContain('Método de pago');
      expect(share.truncated).toBe(false);
    });

    it('sigue sin mencionar montos ni método de pago aunque el pedido ya se haya cobrado (dividido)', async () => {
      const order = await createDeliveryOrder();
      await app.inject({
        method: 'POST',
        url: '/api/cash-sessions',
        headers: authHeader(token),
        payload: { cashRegisterId: fixtures.cashRegisterId, openingAmount: 500 },
      });
      await app.inject({
        method: 'PATCH',
        url: `/api/orders/${order.id}/charge`,
        headers: authHeader(token),
        payload: {
          cashRegisterId: fixtures.cashRegisterId,
          payments: [
            { paymentMethodId: fixtures.cashPaymentMethodId, amount: 120 },
            { paymentMethodId: fixtures.cardPaymentMethodId, amount: 80 },
          ],
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${order.id}/whatsapp`,
        headers: authHeader(token),
      });

      const share = response.json();
      expect(share.message).not.toContain('Método de pago');
      expect(share.message).not.toContain('Total');
    });

    it('rechaza pedir el WhatsApp de un pedido de mostrador', async () => {
      const product = await createTestProduct(testPrisma, { stock: 5 });
      const orderResponse = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(token),
        payload: { channel: 'counter', items: [{ productId: product.id, quantity: 1 }] },
      });
      const order = orderResponse.json();

      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${order.id}/whatsapp`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
