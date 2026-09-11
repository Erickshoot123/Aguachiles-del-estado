import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './testApp.js';
import { disconnectTestDb, resetDatabase, testPrisma } from './testDb.js';
import { seedBaseFixtures, TEST_PASSWORD, type BaseFixtures } from './fixtures.js';

describe('rate limit de login', () => {
  let app: FastifyInstance;
  let fixtures: BaseFixtures;
  const previousMax = process.env.LOGIN_RATE_LIMIT_MAX;

  beforeAll(() => {
    process.env.LOGIN_RATE_LIMIT_MAX = '3';
  });

  afterAll(async () => {
    await disconnectTestDb();
    process.env.LOGIN_RATE_LIMIT_MAX = previousMax;
  });

  // Cada prueba arma su propia app: el contador de @fastify/rate-limit vive
  // en memoria por instancia, así que reutilizar una sola app entre pruebas
  // arrastraría intentos de una prueba a la siguiente.
  beforeEach(async () => {
    await resetDatabase();
    fixtures = await seedBaseFixtures(testPrisma);
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
    await resetDatabase();
  });

  it('bloquea los intentos de login después del límite configurado', async () => {
    const attemptLogin = (): Promise<{ statusCode: number }> =>
      app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: fixtures.adminEmail, password: 'contraseña-incorrecta' },
      });

    const first = await attemptLogin();
    const second = await attemptLogin();
    const third = await attemptLogin();
    const fourth = await attemptLogin();

    expect(first.statusCode).toBe(401);
    expect(second.statusCode).toBe(401);
    expect(third.statusCode).toBe(401);
    expect(fourth.statusCode).toBe(429);
  });

  it('no bloquea el login correcto mientras esté bajo el límite', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: fixtures.adminEmail, password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(200);
  });

  it('el límite es específico de /api/auth/login, no global', async () => {
    for (let i = 0; i < 4; i += 1) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: fixtures.adminEmail, password: 'contraseña-incorrecta' },
      });
    }

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
  });
});
