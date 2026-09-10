import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from './config/env.js';
import authPlugin from './plugins/auth.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import prismaPlugin from './plugins/prisma.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import cashRoutes from './modules/cash/cash.routes.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import ordersRoutes from './modules/orders/orders.routes.js';
import paymentMethodsRoutes from './modules/payment-methods/payment-methods.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import purchasesRoutes from './modules/purchases/purchases.routes.js';
import receiptsRoutes from './modules/receipts/receipts.routes.js';
import refundsRoutes from './modules/refunds/refunds.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import suppliersRoutes from './modules/suppliers/suppliers.routes.js';

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({ logger: env.NODE_ENV !== 'test' });

  await app.register(cors, { origin: env.CORS_ORIGIN });
  await app.register(errorHandlerPlugin);
  await app.register(prismaPlugin);
  await app.register(authPlugin, { env });
  await app.register(authRoutes, { env });
  await app.register(categoriesRoutes);
  await app.register(productsRoutes);
  await app.register(ordersRoutes);
  await app.register(paymentMethodsRoutes);
  await app.register(cashRoutes);
  await app.register(receiptsRoutes);
  await app.register(refundsRoutes);
  await app.register(reportsRoutes);
  await app.register(suppliersRoutes);
  await app.register(purchasesRoutes);
  await app.register(auditRoutes);
  await app.register(analyticsRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
