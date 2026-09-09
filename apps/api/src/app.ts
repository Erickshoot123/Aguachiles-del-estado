import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from './config/env.js';
import authPlugin from './plugins/auth.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import prismaPlugin from './plugins/prisma.js';
import authRoutes from './modules/auth/auth.routes.js';

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: env.CORS_ORIGIN });
  await app.register(errorHandlerPlugin);
  await app.register(prismaPlugin);
  await app.register(authPlugin, { env });
  await app.register(authRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
