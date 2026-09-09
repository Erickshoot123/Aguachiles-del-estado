import { ticketSchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';

/**
 * Endpoint de impresión mínimo para Fase 0: valida el ticket y confirma
 * recepción. La traducción a comandos ESC/POS reales para la impresora
 * térmica se implementa en la Fase 1 (ver PLAN_POS.md, sección 5).
 */
export default async function printRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/print', async (request, reply) => {
    const ticket = ticketSchema.parse(request.body);

    fastify.log.info({ ticketNumber: ticket.ticketNumber }, 'Ticket recibido para impresión');

    reply.status(202).send({ status: 'queued', ticketNumber: ticket.ticketNumber });
  });
}
