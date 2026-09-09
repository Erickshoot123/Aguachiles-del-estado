import { createOrderRequestSchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { idParamSchema } from '../../lib/paramsSchemas.js';
import { requireOpenSession } from '../cash/cash.service.js';
import { advanceOrder, cancelOrder, chargeOrder, createOrder, listActiveOrders } from './orders.service.js';

export default async function ordersRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/orders', { preHandler: fastify.authenticate }, async (_request, reply) => {
    const orders = await listActiveOrders(fastify.prisma);
    reply.status(200).send(orders);
  });

  fastify.post('/api/orders', { preHandler: fastify.authenticate }, async (request, reply) => {
    const input = createOrderRequestSchema.parse(request.body);
    const order = await createOrder(fastify.prisma, request.user.sub, input);
    reply.status(201).send(order);
  });

  fastify.patch(
    '/api/orders/:id/advance',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const order = await advanceOrder(fastify.prisma, id);
      reply.status(200).send(order);
    },
  );

  fastify.patch(
    '/api/orders/:id/cancel',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const order = await cancelOrder(fastify.prisma, id);
      reply.status(200).send(order);
    },
  );

  fastify.patch(
    '/api/orders/:id/charge',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const { id: cashSessionId } = await requireOpenSession(fastify.prisma);
      const order = await chargeOrder(fastify.prisma, id, request.user.sub, cashSessionId);
      reply.status(200).send(order);
    },
  );
}
