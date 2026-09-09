import { closeCashSessionRequestSchema, openCashSessionRequestSchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { closeSession, getCurrentSession, openSession } from './cash.service.js';

const sessionParamsSchema = z.object({ id: z.string().uuid() });

export default async function cashRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/cash-sessions/current',
    { preHandler: fastify.authenticate },
    async (_request, reply) => {
      const session = await getCurrentSession(fastify.prisma);
      reply.status(200).send(session);
    },
  );

  fastify.post('/api/cash-sessions', { preHandler: fastify.authenticate }, async (request, reply) => {
    const input = openCashSessionRequestSchema.parse(request.body);
    const session = await openSession(fastify.prisma, request.user.sub, input.openingAmount);
    reply.status(201).send(session);
  });

  fastify.patch(
    '/api/cash-sessions/:id/close',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = sessionParamsSchema.parse(request.params);
      const input = closeCashSessionRequestSchema.parse(request.body);
      const session = await closeSession(
        fastify.prisma,
        id,
        request.user.sub,
        input.actualClosingAmount,
      );
      reply.status(200).send(session);
    },
  );
}
