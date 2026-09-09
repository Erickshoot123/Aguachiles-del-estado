import { createOrderRequestSchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { advanceOrder, cancelOrder, createOrder, listActiveOrders } from './orders.service.js';

const orderParamsSchema = z.object({ id: z.string().uuid() });

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
      const { id } = orderParamsSchema.parse(request.params);
      const order = await advanceOrder(fastify.prisma, id);
      reply.status(200).send(order);
    },
  );

  fastify.patch(
    '/api/orders/:id/cancel',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = orderParamsSchema.parse(request.params);
      const order = await cancelOrder(fastify.prisma, id);
      reply.status(200).send(order);
    },
  );
}
