import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { TEST_PASSWORD } from './fixtures.js';

export async function buildTestApp(): Promise<FastifyInstance> {
  // loadEnv() lee de process.env, que tests/setup.ts ya apuntó a la base de
  // datos y secretos de prueba antes de que este archivo se importe.
  const env = loadEnv();
  return buildApp(env);
}

export async function loginAs(
  app: FastifyInstance,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  if (response.statusCode !== 200) {
    throw new Error(`No se pudo iniciar sesión como ${email}: ${response.statusCode} ${response.body}`);
  }
  const body = response.json() as { accessToken: string };
  return body.accessToken;
}

export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}
