import {
  closeCashSessionRequestSchema,
  createCashMovementRequestSchema,
  openCashSessionRequestSchema,
} from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { idParamSchema } from '../../lib/paramsSchemas.js';
import {
  closeSession,
  createCashMovement,
  getCurrentSession,
  listCashMovements,
  openSession,
} from './cash.service.js';

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
      const { id } = idParamSchema.parse(request.params);
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

  fastify.get(
    '/api/cash-sessions/:id/movements',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const movements = await listCashMovements(fastify.prisma, id);
      reply.status(200).send(movements);
    },
  );

  fastify.post(
    '/api/cash-sessions/:id/movements',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const input = createCashMovementRequestSchema.parse(request.body);
      const movement = await createCashMovement(fastify.prisma, id, request.user.sub, input);
      reply.status(201).send(movement);
    },
  );
}
