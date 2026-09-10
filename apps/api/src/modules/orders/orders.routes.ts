import { chargeOrderRequestSchema, createOrderRequestSchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { idParamSchema } from '../../lib/paramsSchemas.js';
import { requireOpenSession } from '../cash/cash.service.js';
import {
  advanceOrder,
  cancelOrder,
  chargeOrder,
  createOrder,
  findOrderByTicketNumber,
  listActiveOrders,
} from './orders.service.js';

const lookupQuerySchema = z.object({ ticketNumber: z.string().min(1) });

export default async function ordersRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/orders', { preHandler: fastify.authenticate }, async (_request, reply) => {
    const orders = await listActiveOrders(fastify.prisma);
    reply.status(200).send(orders);
  });

  fastify.get(
    '/api/orders/lookup',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { ticketNumber } = lookupQuerySchema.parse(request.query);
      const order = await findOrderByTicketNumber(fastify.prisma, ticketNumber);
      reply.status(200).send(order);
    },
  );

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
      const input = chargeOrderRequestSchema.parse(request.body);
      const { id: cashSessionId } = await requireOpenSession(fastify.prisma, input.cashRegisterId);
      const order = await chargeOrder(
        fastify.prisma,
        id,
        request.user.sub,
        cashSessionId,
        input.payments,
      );
      reply.status(200).send(order);
    },
  );
}
