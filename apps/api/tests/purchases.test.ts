import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';
import { createTestProduct, seedBaseFixtures, TEST_PASSWORD, type BaseFixtures } from './fixtures.js';

describe('compras', () => {
  let app: FastifyInstance;
  let fixtures: BaseFixtures;
  let token: string;
  let supplierId: string;

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
    const supplier = await testPrisma.supplier.create({ data: { name: 'Proveedor de prueba' } });
    supplierId = supplier.id;
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it('suma el stock recibido a una compra', async () => {
    const product = await createTestProduct(testPrisma, { stock: 10 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/purchases',
      headers: authHeader(token),
      payload: {
        supplierId,
        items: [{ productId: product.id, quantity: 5 }],
      },
    });

    expect(response.statusCode).toBe(201);
    const inventory = await testPrisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity.toNumber()).toBe(15);
  });

  it('dos compras simultáneas del mismo producto suman ambas cantidades sin perderse entre sí', async () => {
    const product = await createTestProduct(testPrisma, { stock: 10 });

    const buyRequest = (quantity: number) =>
      app.inject({
        method: 'POST',
        url: '/api/purchases',
        headers: authHeader(token),
        payload: {
          supplierId,
          items: [{ productId: product.id, quantity }],
        },
      });

    const [first, second] = await Promise.all([buyRequest(5), buyRequest(3)]);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);

    // Sin el increment atómico, la compra que confirma después sobrescribe el
    // stock con su propio total calculado a partir de una lectura vieja,
    // perdiendo lo que sumó la otra (10 + 5 = 15 en vez de 10 + 5 + 3 = 18).
    const inventory = await testPrisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity.toNumber()).toBe(18);
  });

  it('rechaza una compra de un producto que no existe', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/purchases',
      headers: authHeader(token),
      payload: {
        supplierId,
        items: [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('un cajero no puede registrar una compra', async () => {
    const cajeroToken = await loginAs(app, fixtures.cajeroEmail, TEST_PASSWORD);
    const product = await createTestProduct(testPrisma, { stock: 10 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/purchases',
      headers: authHeader(cajeroToken),
      payload: {
        supplierId,
        items: [{ productId: product.id, quantity: 1 }],
      },
    });

    expect(response.statusCode).toBe(403);
  });
});
