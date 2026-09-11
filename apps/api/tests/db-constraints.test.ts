import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';
import { createTestProduct, seedBaseFixtures, TEST_PASSWORD, type BaseFixtures } from './fixtures.js';

describe('constraints de base de datos', () => {
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

  it('rechaza crear un producto con un SKU duplicado', async () => {
    await createTestProduct(testPrisma, { sku: 'SKU-DUP' });

    const category = await testPrisma.category.findFirst({ where: { name: 'Menú de prueba' } });
    const response = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: authHeader(token),
      payload: {
        sku: 'SKU-DUP',
        name: 'Otro producto',
        categoryId: category?.id,
        price: 50,
        cost: 20,
        taxRate: 0,
        unit: 'pieza',
        initialStock: 5,
      },
    });

    expect(response.statusCode).toBe(409);
  });

  it('rechaza un correo de usuario duplicado a nivel de base de datos', async () => {
    await expect(
      testPrisma.user.create({
        data: {
          name: 'Duplicado',
          email: fixtures.adminEmail,
          passwordHash: 'x',
          roleId: fixtures.roleIds.cajero,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('el folio de ticket es único a nivel de base de datos', async () => {
    const product = await createTestProduct(testPrisma);
    const first = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'delivery', items: [{ productId: product.id, quantity: 1 }] },
    });
    const ticketNumber = first.json().ticketNumber as string;

    await expect(
      testPrisma.sale.create({
        data: {
          ticketNumber,
          userId: (await testPrisma.user.findUniqueOrThrow({ where: { email: fixtures.adminEmail } })).id,
          locationId: fixtures.locationId,
          subtotal: new Prisma.Decimal(0),
          taxTotal: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('ON DELETE RESTRICT impide borrar una sucursal con ventas asociadas', async () => {
    const product = await createTestProduct(testPrisma);
    await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'delivery', items: [{ productId: product.id, quantity: 1 }] },
    });

    await expect(testPrisma.location.delete({ where: { id: fixtures.locationId } })).rejects.toMatchObject({
      code: 'P2003',
    });
  });

  it('ON DELETE RESTRICT impide borrar un producto con movimientos de inventario', async () => {
    const product = await createTestProduct(testPrisma);
    await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(token),
      payload: { channel: 'delivery', items: [{ productId: product.id, quantity: 1 }] },
    });

    await expect(testPrisma.product.delete({ where: { id: product.id } })).rejects.toMatchObject({
      code: 'P2003',
    });
  });
});
