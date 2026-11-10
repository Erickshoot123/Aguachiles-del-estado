import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, afterEach, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { authHeader, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma as db } from './testDb.js';
import { createTestProduct, seedBaseFixtures, type BaseFixtures } from './fixtures.js';

let app: FastifyInstance;
let fixture: BaseFixtures;
let admin: string;
let cashier: string;
let phase = 'idle';
let calls: string[] = [];
beforeEach(async () => {
  await resetDatabase();
  fixture = await seedBaseFixtures(db);
  phase = 'idle';
  calls = [];
  app = await buildApp(loadEnv(), {
    requestUpdate: async (action) => {
      calls.push(action);
      if (action === 'install') phase = 'installing';
      return { phase };
    },
  });
  admin = await loginAs(app, fixture.adminUsername);
  cashier = await loginAs(app, fixture.cajeroUsername);
});
afterEach(async () => {
  await app.close();
  await resetDatabase();
});
afterAll(disconnectTestDb);
const action = (name: string, confirmed = false, token = admin) =>
  app.inject({
    method: 'POST',
    url: '/api/updates/action',
    headers: authHeader(token),
    payload: { action: name, confirmed },
  });
it('no consulta actualizaciones al arrancar, exige permisos y permite buscar/descargar con caja abierta', async () => {
  expect(calls).toEqual([]);
  expect((await app.inject('/api/updates/status')).statusCode).toBe(401);
  expect((await action('check', false, cashier)).statusCode).toBe(403);
  await app.inject({
    method: 'POST',
    url: '/api/cash-sessions',
    headers: authHeader(admin),
    payload: { cashRegisterId: fixture.cashRegisterId, openingAmount: 500 },
  });
  expect((await action('check')).statusCode).toBe(200);
  expect((await action('download')).statusCode).toBe(200);
  expect(calls).toEqual(['check', 'download']);
});
it('bloquea Usuarios y Actualizaciones para un gerente incluso con un token anterior', async () => {
  const manager = await db.user.create({
    data: {
      name: 'Gerente de prueba',
      username: 'gerente-prueba',
      roleId: fixture.roleIds.gerente,
      passwordHash: 'hash-no-usado-en-esta-prueba',
    },
  });
  const managerToken = app.jwt.sign({
    sub: manager.id,
    roleName: 'gerente',
    permissions: ['users.manage'],
  });
  const headers = authHeader(managerToken);
  expect((await app.inject({ url: '/api/auth/users', headers })).statusCode).toBe(403);
  expect((await app.inject({ url: '/api/updates/status', headers })).statusCode).toBe(403);
  expect((await action('check', false, managerToken)).statusCode).toBe(403);
  expect(calls).toEqual([]);
});
it('requiere confirmación y cajas cerradas; no envía la orden de instalación si el negocio sigue operando', async () => {
  expect((await action('install')).statusCode).toBe(409);
  await app.inject({
    method: 'POST',
    url: '/api/cash-sessions',
    headers: authHeader(admin),
    payload: { cashRegisterId: fixture.cashRegisterId, openingAmount: 500 },
  });
  const blocked = await action('install', true);
  expect(blocked.statusCode).toBe(409);
  expect(blocked.json().message).toContain('Cierra las cajas');
  expect(calls).toEqual([]);
});
it('bloquea nuevos pedidos al instalar y libera la operación si falla el actualizador', async () => {
  expect((await action('install', true)).json().phase).toBe('installing');
  const product = await createTestProduct(db);
  const payload = { channel: 'counter', items: [{ productId: product.id, quantity: 1 }] };
  expect(
    (await app.inject({ method: 'POST', url: '/api/orders', headers: authHeader(admin), payload }))
      .statusCode,
  ).toBe(503);
  phase = 'error';
  // Debe recuperarse aunque la pantalla de actualizaciones se haya cerrado.
  expect(
    (await app.inject({ method: 'POST', url: '/api/orders', headers: authHeader(admin), payload }))
      .statusCode,
  ).toBe(201);
});
it('un movimiento iniciado impide instalar y no se interrumpe la solicitud que está en curso', async () => {
  let arrived!: () => void;
  let finish!: () => void;
  const started = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  const release = new Promise<void>((resolve) => {
    finish = resolve;
  });
  // Esta prueba usa un segundo app porque Fastify no permite agregar rutas después de iniciar.
  await app.close();
  app = await buildApp(loadEnv(), {
    requestUpdate: async () => {
      calls.push('install');
      return { phase: 'installing' };
    },
  });
  app.post('/api/test-movement', { preHandler: app.authenticate }, async () => {
    arrived();
    await release;
    return { ok: true };
  });
  admin = await loginAs(app, fixture.adminUsername);
  const movement = app
    .inject({ method: 'POST', url: '/api/test-movement', headers: authHeader(admin) })
    .then((response) => response);
  await started;
  try {
    expect((await action('install', true)).statusCode).toBe(409);
    expect(calls).toEqual([]);
  } finally {
    finish();
  }
  expect((await movement).statusCode).toBe(200);
});
