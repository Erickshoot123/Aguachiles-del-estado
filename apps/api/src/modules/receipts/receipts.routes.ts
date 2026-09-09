import type { FastifyInstance } from 'fastify';
import { idParamSchema } from '../../lib/paramsSchemas.js';
import { getReceiptTicket, recordPrinted } from './receipts.service.js';

export default async function receiptsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/orders/:id/receipt',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const receipt = await getReceiptTicket(fastify.prisma, id);
      reply.status(200).send(receipt);
    },
  );

  fastify.post(
    '/api/orders/:id/receipt/printed',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      await recordPrinted(fastify.prisma, id);
      reply.status(204).send();
    },
  );
}
