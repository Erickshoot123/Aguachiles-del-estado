import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';
import { seedBaseFixtures, TEST_PASSWORD, type BaseFixtures } from './fixtures.js';

describe('productos: complementos/extras', () => {
  let app: FastifyInstance;
  let fixtures: BaseFixtures;
  let token: string;
  let categoryId: string;

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
    const category = await testPrisma.category.create({ data: { name: 'Menú' } });
    categoryId = category.id;
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it('crea un producto marcado como extra/complemento', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: authHeader(token),
      payload: {
        sku: 'TOSTADAS-10',
        name: 'Tostadas extra (10 pzas)',
        categoryId,
        price: 12,
        cost: 5,
        unit: 'paquete',
        initialStock: 50,
        isComplement: true,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().isComplement).toBe(true);
  });

  it('un producto creado sin especificar isComplement no es un extra por defecto', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: authHeader(token),
      payload: {
        sku: 'AGU-COLORADO-1KG',
        name: 'Aguachile colorado (1 kilo)',
        categoryId,
        price: 279,
        cost: 140,
        unit: 'pieza',
        initialStock: 20,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().isComplement).toBe(false);
  });

  it('el listado de productos activos distingue principales de extras', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: authHeader(token),
      payload: {
        sku: 'TOSTITOS',
        name: 'Tostitos salsa verde',
        categoryId,
        price: 20,
        cost: 8,
        unit: 'pieza',
        initialStock: 30,
        isComplement: true,
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: authHeader(token),
      payload: {
        sku: 'AGU-PRIETO-MKG',
        name: 'Aguachile prieto (medio kilo)',
        categoryId,
        price: 149,
        cost: 75,
        unit: 'pieza',
        initialStock: 20,
        isComplement: false,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: authHeader(token),
    });

    expect(response.statusCode).toBe(200);
    const products = response.json() as Array<{ name: string; isComplement: boolean }>;
    const tostitos = products.find((p) => p.name === 'Tostitos salsa verde');
    const prieto = products.find((p) => p.name === 'Aguachile prieto (medio kilo)');
    expect(tostitos?.isComplement).toBe(true);
    expect(prieto?.isComplement).toBe(false);
  });

  it('se puede editar un producto existente para marcarlo como extra', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: authHeader(token),
      payload: {
        sku: 'TOSTADAS-5',
        name: 'Tostadas extra (5 pzas)',
        categoryId,
        price: 6,
        cost: 2,
        unit: 'paquete',
        initialStock: 40,
      },
    });
    const productId = created.json().id as string;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/products/${productId}`,
      headers: authHeader(token),
      payload: { isComplement: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().isComplement).toBe(true);
  });
});

describe('canal de pedidos: mostrador/delivery', () => {
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

  async function createProductForOrder(): Promise<string> {
    const category = await testPrisma.category.create({ data: { name: 'Menú de prueba de canal' } });
    const product = await testPrisma.product.create({
      data: { sku: `SKU-${Math.random().toString(36).slice(2, 10)}`, name: 'Producto', categoryId: category.id, price: 100, cost: 50, unit: 'pieza' },
    });
    await testPrisma.inventory.create({ data: { productId: product.id, quantity: 10 } });
    return product.id;
  }

  it('acepta "counter" y "delivery" como canal', async () => {
    const productId = await createProductForOrder();

    const counterResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'counter', items: [{ productId, quantity: 1 }] },
    });
    const deliveryResponse = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'delivery', items: [{ productId, quantity: 1 }] },
    });

    expect(counterResponse.statusCode).toBe(201);
    expect(deliveryResponse.statusCode).toBe(201);
  });

  it('rechaza un canal que ya no existe (ej. "phone")', async () => {
    const productId = await createProductForOrder();

    const response = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'phone', items: [{ productId, quantity: 1 }] },
    });

    expect(response.statusCode).toBe(400);
  });
});
