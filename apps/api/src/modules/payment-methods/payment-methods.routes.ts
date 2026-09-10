import type { FastifyInstance } from 'fastify';
import { listActivePaymentMethods } from './payment-methods.service.js';

export default async function paymentMethodsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/payment-methods',
    { preHandler: fastify.authenticate },
    async (_request, reply) => {
      reply.status(200).send(await listActivePaymentMethods(fastify.prisma));
    },
  );
}
