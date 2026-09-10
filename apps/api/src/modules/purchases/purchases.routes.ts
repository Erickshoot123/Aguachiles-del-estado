import { createPurchaseRequestSchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { createPurchase, listPurchases } from './purchases.service.js';

export default async function purchasesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/purchases', { preHandler: fastify.authenticate }, async (_request, reply) => {
    reply.status(200).send(await listPurchases(fastify.prisma));
  });

  fastify.post('/api/purchases', { preHandler: fastify.authenticate }, async (request, reply) => {
    const input = createPurchaseRequestSchema.parse(request.body);
    const purchase = await createPurchase(fastify.prisma, request.user.sub, input);
    reply.status(201).send(purchase);
  });
}
