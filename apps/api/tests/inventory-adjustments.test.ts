import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';
import { createTestProduct, seedBaseFixtures, TEST_PASSWORD, type BaseFixtures } from './fixtures.js';

describe('ajustes manuales de inventario', () => {
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

  it('un ajuste de entrada incrementa el stock y registra el movimiento', async () => {
    const product = await createTestProduct(testPrisma, { stock: 10 });

    const response = await app.inject({
      method: 'POST',
      url: `/api/products/${product.id}/inventory-adjustments`,
      headers: authHeader(token),
      payload: { type: 'adjustment_in', quantity: 5, reason: 'Conteo físico: sobrante' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.previousStock).toBe(10);
    expect(body.newStock).toBe(15);

    const inventory = await testPrisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity.toNumber()).toBe(15);

    const movement = await testPrisma.inventoryMovement.findFirst({ where: { productId: product.id } });
    expect(movement?.type).toBe('adjustment_in');
    expect(movement?.quantity.toNumber()).toBe(5);
    expect(movement?.previousStock.toNumber()).toBe(10);
    expect(movement?.newStock.toNumber()).toBe(15);
    expect(movement?.reason).toBe('Conteo físico: sobrante');
  });

  it('un ajuste de salida decrementa el stock', async () => {
    const product = await createTestProduct(testPrisma, { stock: 10 });

    const response = await app.inject({
      method: 'POST',
      url: `/api/products/${product.id}/inventory-adjustments`,
      headers: authHeader(token),
      payload: { type: 'adjustment_out', quantity: 3, reason: 'Producto dañado' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.previousStock).toBe(10);
    expect(body.newStock).toBe(7);

    const inventory = await testPrisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity.toNumber()).toBe(7);
  });

  it('rechaza un ajuste de salida que dejaría el stock en negativo', async () => {
    const product = await createTestProduct(testPrisma, { stock: 2 });

    const response = await app.inject({
      method: 'POST',
      url: `/api/products/${product.id}/inventory-adjustments`,
      headers: authHeader(token),
      payload: { type: 'adjustment_out', quantity: 5, reason: 'Producto dañado' },
    });

    expect(response.statusCode).toBe(409);

    const inventory = await testPrisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inventory?.quantity.toNumber()).toBe(2);
  });

  it('rechaza un ajuste sin razón', async () => {
    const product = await createTestProduct(testPrisma, { stock: 10 });

    const response = await app.inject({
      method: 'POST',
      url: `/api/products/${product.id}/inventory-adjustments`,
      headers: authHeader(token),
      payload: { type: 'adjustment_in', quantity: 5, reason: '' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('un cajero no puede hacer ajustes de inventario', async () => {
    const product = await createTestProduct(testPrisma, { stock: 10 });
    const cajeroToken = await loginAs(app, fixtures.cajeroEmail, TEST_PASSWORD);

    const response = await app.inject({
      method: 'POST',
      url: `/api/products/${product.id}/inventory-adjustments`,
      headers: authHeader(cajeroToken),
      payload: { type: 'adjustment_in', quantity: 5, reason: 'Conteo físico' },
    });

    expect(response.statusCode).toBe(403);
  });
});
