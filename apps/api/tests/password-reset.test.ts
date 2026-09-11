import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, buildTestApp, loginAs } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';
import { seedBaseFixtures, TEST_PASSWORD, type BaseFixtures } from './fixtures.js';

describe('reseteo de contraseña por un admin', () => {
  let app: FastifyInstance;
  let fixtures: BaseFixtures;
  let adminToken: string;

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
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it('un admin puede resetear la contraseña de otro usuario', async () => {
    const cajero = await testPrisma.user.findUniqueOrThrow({ where: { email: fixtures.cajeroEmail } });

    const response = await app.inject({
      method: 'POST',
      url: `/api/auth/users/${cajero.id}/reset-password`,
      headers: authHeader(adminToken),
      payload: { newPassword: 'NuevaContraseña123!' },
    });

    expect(response.statusCode).toBe(204);

    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: fixtures.cajeroEmail, password: TEST_PASSWORD },
    });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: fixtures.cajeroEmail, password: 'NuevaContraseña123!' },
    });
    expect(newLogin.statusCode).toBe(200);
  });

  it('revoca las sesiones activas del usuario al resetear su contraseña', async () => {
    const cajero = await testPrisma.user.findUniqueOrThrow({ where: { email: fixtures.cajeroEmail } });
    const cajeroLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: fixtures.cajeroEmail, password: TEST_PASSWORD },
    });
    const { refreshToken } = cajeroLogin.json();

    await app.inject({
      method: 'POST',
      url: `/api/auth/users/${cajero.id}/reset-password`,
      headers: authHeader(adminToken),
      payload: { newPassword: 'NuevaContraseña123!' },
    });

    const refreshAttempt = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    });

    expect(refreshAttempt.statusCode).toBe(401);
  });

  it('un cajero no puede resetear contraseñas', async () => {
    const admin = await testPrisma.user.findUniqueOrThrow({ where: { email: fixtures.adminEmail } });
    const cajeroToken = await loginAs(app, fixtures.cajeroEmail, TEST_PASSWORD);

    const response = await app.inject({
      method: 'POST',
      url: `/api/auth/users/${admin.id}/reset-password`,
      headers: authHeader(cajeroToken),
      payload: { newPassword: 'NuevaContraseña123!' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('rechaza una contraseña nueva demasiado corta', async () => {
    const cajero = await testPrisma.user.findUniqueOrThrow({ where: { email: fixtures.cajeroEmail } });

    const response = await app.inject({
      method: 'POST',
      url: `/api/auth/users/${cajero.id}/reset-password`,
      headers: authHeader(adminToken),
      payload: { newPassword: 'corta' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('un admin puede listar los usuarios', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/users',
      headers: authHeader(adminToken),
    });

    expect(response.statusCode).toBe(200);
    const users = response.json() as Array<{ email: string }>;
    expect(users.some((user) => user.email === fixtures.cajeroEmail)).toBe(true);
  });

  it('un cajero no puede listar los usuarios', async () => {
    const cajeroToken = await loginAs(app, fixtures.cajeroEmail, TEST_PASSWORD);

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/users',
      headers: authHeader(cajeroToken),
    });

    expect(response.statusCode).toBe(403);
  });

  it('devuelve 404 si el usuario no existe', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/users/00000000-0000-0000-0000-000000000000/reset-password',
      headers: authHeader(adminToken),
      payload: { newPassword: 'NuevaContraseña123!' },
    });

    expect(response.statusCode).toBe(404);
  });
});
