import { createRefundRequestSchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { idParamSchema } from '../../lib/paramsSchemas.js';
import { requireOpenSession } from '../cash/cash.service.js';
import { createRefund, getRefundableSale } from './refunds.service.js';

export default async function refundsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/orders/:id/refundable',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const refundable = await getRefundableSale(fastify.prisma, id);
      reply.status(200).send(refundable);
    },
  );

  fastify.post(
    '/api/orders/:id/refund',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const input = createRefundRequestSchema.parse(request.body);
      const { id: cashSessionId } = await requireOpenSession(fastify.prisma, input.cashRegisterId);

      const refund = await createRefund(fastify.prisma, id, request.user.sub, cashSessionId, input);
      reply.status(201).send(refund);
    },
  );
}
