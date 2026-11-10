import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { seedBaseFixtures, type BaseFixtures } from './fixtures.js';
import { authHeader, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';

let app: FastifyInstance;
let fixture: BaseFixtures;
let admin: string;
const initialPassword = 'inicial-6';
const newPassword = 'propia-123';
const staff = {
  name: 'María Prueba',
  username: 'maria-prueba',
  roleName: 'cajero',
  initialPassword,
};

beforeEach(async () => {
  await resetDatabase();
  fixture = await seedBaseFixtures(testPrisma);
  app = await buildApp(loadEnv());
  admin = await loginAs(app, fixture.adminUsername);
});
afterEach(async () => {
  await app.close();
});
afterAll(disconnectTestDb);

const create = (token: string, payload = staff) =>
  app.inject({ method: 'POST', url: '/api/auth/users', headers: authHeader(token), payload });
const login = (password: string) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: staff.username, password },
  });
const changePassword = (token: string, currentPassword: string) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/change-password',
    headers: authHeader(token),
    payload: { currentPassword, newPassword },
  });
const refresh = (refreshToken: string) =>
  app.inject({ method: 'POST', url: '/api/auth/refresh', payload: { refreshToken } });
const orders = (token: string) => app.inject({ url: '/api/orders', headers: authHeader(token) });
const setActive = (token: string, userId: string, isActive: boolean) =>
  app.inject({
    method: 'PATCH',
    url: `/api/auth/users/${userId}/status`,
    headers: authHeader(token),
    payload: { isActive },
  });

it('solo el administrador puede dar de alta personal y el usuario es único', async () => {
  const cashier = await loginAs(app, fixture.cajeroUsername);
  expect((await create(cashier)).statusCode).toBe(403);
  expect((await create(admin, { ...staff, roleName: 'admin' })).statusCode).toBe(400);
  const results = await Promise.all([
    create(admin, { ...staff, roleName: 'gerente' }),
    create(admin, { ...staff, username: 'MARIA-PRUEBA', roleName: 'gerente' }),
  ]);
  expect(results.map(({ statusCode }) => statusCode).sort()).toEqual([201, 409]);
  const created = results.find(({ statusCode }) => statusCode === 201)!.json();
  expect(created).toMatchObject({ username: staff.username, roleName: 'gerente', isActive: true });
  expect(created).not.toHaveProperty('passwordHash');
  expect(created).not.toHaveProperty('initialPassword');
});

it('exige cambiar la contraseña inicial y revoca las sesiones al desactivar o reactivar', async () => {
  const created = (await create(admin)).json();
  const firstLogin = await login(initialPassword);
  expect(firstLogin.statusCode).toBe(200);
  const firstSession = firstLogin.json();
  expect(firstSession.user.mustChangePassword).toBe(true);
  expect((await orders(firstSession.accessToken)).statusCode).toBe(403);
  expect((await changePassword(firstSession.accessToken, 'incorrecta')).statusCode).toBe(400);
  expect((await changePassword(firstSession.accessToken, initialPassword)).statusCode).toBe(204);
  expect((await refresh(firstSession.refreshToken)).statusCode).toBe(401);
  expect((await orders(firstSession.accessToken)).statusCode).toBe(401);
  expect((await login(initialPassword)).statusCode).toBe(401);
  const staffSession = (await login(newPassword)).json();
  expect(staffSession.user.mustChangePassword).toBe(false);
  expect((await orders(staffSession.accessToken)).statusCode).toBe(200);
  expect((await setActive(staffSession.accessToken, created.id, false)).statusCode).toBe(403);
  const adminAccount = await testPrisma.user.findUniqueOrThrow({
    where: { username: fixture.adminUsername },
  });
  expect((await setActive(admin, adminAccount.id, false)).statusCode).toBe(403);
  expect((await setActive(admin, created.id, false)).statusCode).toBe(204);
  expect((await orders(staffSession.accessToken)).statusCode).toBe(401);
  expect((await refresh(staffSession.refreshToken)).statusCode).toBe(401);
  expect((await login(newPassword)).statusCode).toBe(401);
  expect((await setActive(admin, created.id, true)).statusCode).toBe(204);
  expect((await orders(staffSession.accessToken)).statusCode).toBe(401);
  expect((await login(newPassword)).statusCode).toBe(200);
  const events = await testPrisma.auditLog.findMany({ where: { entityId: created.id } });
  expect(events.map(({ action }) => action)).toEqual(
    expect.arrayContaining([
      'user.created',
      'user.password_changed',
      'user.deactivated',
      'user.activated',
    ]),
  );
  expect(JSON.stringify(events)).not.toContain(initialPassword);
  expect(JSON.stringify(events)).not.toContain(newPassword);
});
