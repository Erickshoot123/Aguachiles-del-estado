import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from './config/env.js';
import authPlugin from './plugins/auth.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import prismaPlugin from './plugins/prisma.js';
import authRoutes from './modules/auth/auth.routes.js';
import cashRoutes from './modules/cash/cash.routes.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import ordersRoutes from './modules/orders/orders.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import receiptsRoutes from './modules/receipts/receipts.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: env.CORS_ORIGIN });
  await app.register(errorHandlerPlugin);
  await app.register(prismaPlugin);
  await app.register(authPlugin, { env });
  await app.register(authRoutes, { env });
  await app.register(categoriesRoutes);
  await app.register(productsRoutes);
  await app.register(ordersRoutes);
  await app.register(cashRoutes);
  await app.register(receiptsRoutes);
  await app.register(reportsRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
