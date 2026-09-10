import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';
import { seedBaseFixtures, TEST_PASSWORD, type BaseFixtures } from './fixtures.js';

describe('caja', () => {
  let app: FastifyInstance;
  let fixtures: BaseFixtures;
  let adminToken: string;
  let cajeroToken: string;

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
    adminToken = await loginAs(app, fixtures.adminEmail, TEST_PASSWORD);
    cajeroToken = await loginAs(app, fixtures.cajeroEmail, TEST_PASSWORD);
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it('rechaza abrir una segunda sesión en la misma caja registradora ya abierta', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/cash-sessions',
      headers: authHeader(adminToken),
      payload: { cashRegisterId: fixtures.cashRegisterId, openingAmount: 500 },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/cash-sessions',
      headers: authHeader(adminToken),
      payload: { cashRegisterId: fixtures.cashRegisterId, openingAmount: 500 },
    });
    expect(second.statusCode).toBe(409);

    const openSessions = await testPrisma.cashRegisterSession.count({
      where: { cashRegisterId: fixtures.cashRegisterId, status: 'open' },
    });
    expect(openSessions).toBe(1);
  });

  it('el cierre calcula la diferencia entre lo esperado y lo contado', async () => {
    const openResponse = await app.inject({
      method: 'POST',
      url: '/api/cash-sessions',
      headers: authHeader(adminToken),
      payload: { cashRegisterId: fixtures.cashRegisterId, openingAmount: 500 },
    });
    const session = openResponse.json();

    await app.inject({
      method: 'POST',
      url: `/api/cash-sessions/${session.id}/movements`,
      headers: authHeader(adminToken),
      payload: { type: 'deposit', amount: 100, description: 'fondo extra' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/cash-sessions/${session.id}/movements`,
      headers: authHeader(adminToken),
      payload: { type: 'withdrawal', amount: 50, description: 'pago proveedor' },
    });

    const closeResponse = await app.inject({
      method: 'PATCH',
      url: `/api/cash-sessions/${session.id}/close`,
      headers: authHeader(adminToken),
      payload: { actualClosingAmount: 530 },
    });

    expect(closeResponse.statusCode).toBe(200);
    const closed = closeResponse.json();
    // 500 fondo + 100 ingreso - 50 retiro = 550 esperado; contado 530 => diferencia -20
    expect(closed.expectedClosingAmount).toBe(550);
    expect(closed.difference).toBe(-20);
  });

  it('un cajero no puede registrar un retiro de caja', async () => {
    const openResponse = await app.inject({
      method: 'POST',
      url: '/api/cash-sessions',
      headers: authHeader(adminToken),
      payload: { cashRegisterId: fixtures.cashRegisterId, openingAmount: 500 },
    });
    const session = openResponse.json();

    const response = await app.inject({
      method: 'POST',
      url: `/api/cash-sessions/${session.id}/movements`,
      headers: authHeader(cajeroToken),
      payload: { type: 'withdrawal', amount: 50, description: 'intento no autorizado' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('un cajero sí puede registrar un ingreso de caja', async () => {
    const openResponse = await app.inject({
      method: 'POST',
      url: '/api/cash-sessions',
      headers: authHeader(adminToken),
      payload: { cashRegisterId: fixtures.cashRegisterId, openingAmount: 500 },
    });
    const session = openResponse.json();

    const response = await app.inject({
      method: 'POST',
      url: `/api/cash-sessions/${session.id}/movements`,
      headers: authHeader(cajeroToken),
      payload: { type: 'deposit', amount: 50, description: 'ingreso normal' },
    });

    expect(response.statusCode).toBe(201);
  });
});
