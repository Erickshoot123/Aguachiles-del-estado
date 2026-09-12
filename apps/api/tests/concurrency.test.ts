import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';
import { createTestProduct, seedBaseFixtures, TEST_PASSWORD, type BaseFixtures } from './fixtures.js';

describe('concurrencia', () => {
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

  it('varios pedidos simultáneos por el mismo producto: todos tienen éxito (el stock ya no limita las ventas)', async () => {
    const product = await createTestProduct(testPrisma, { stock: 1 });
    const CONCURRENT_REQUESTS = 8;

    const createOrder = (): Promise<{ statusCode: number }> =>
      app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(token),
        payload: { channel: 'delivery', items: [{ productId: product.id, quantity: 1 }] },
      });

    const results = await Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, createOrder));
    const succeeded = results.filter((result) => result.statusCode === 201);

    expect(succeeded).toHaveLength(CONCURRENT_REQUESTS);

    const stock = await testPrisma.inventory.findUnique({ where: { productId: product.id } });
    expect(stock?.quantity.toNumber()).toBe(1);

    const sales = await testPrisma.sale.count({ where: { status: 'pending' } });
    expect(sales).toBe(CONCURRENT_REQUESTS);
  });

  it('varias aperturas simultáneas de la misma caja registradora: solo una debe tener éxito', async () => {
    const CONCURRENT_REQUESTS = 8;
    const openSession = (): Promise<{ statusCode: number }> =>
      app.inject({
        method: 'POST',
        url: '/api/cash-sessions',
        headers: authHeader(token),
        payload: { cashRegisterId: fixtures.cashRegisterId, openingAmount: 500 },
      });

    const results = await Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, openSession));
    const succeeded = results.filter((result) => result.statusCode === 201);
    const rejected = results.filter((result) => result.statusCode === 409);

    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(CONCURRENT_REQUESTS - 1);

    const openSessions = await testPrisma.cashRegisterSession.count({
      where: { cashRegisterId: fixtures.cashRegisterId, status: 'open' },
    });
    expect(openSessions).toBe(1);
  });
});
