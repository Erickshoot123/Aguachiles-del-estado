import { ticketSchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import type { Env } from './config/env.js';
import { printTicket } from './printers/printJob.js';

export default async function printRoutes(
  fastify: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  fastify.post('/print', async (request, reply) => {
    const ticket = ticketSchema.parse(request.body);

    try {
      await printTicket(ticket, opts.env);
    } catch (error) {
      fastify.log.error({ err: error, ticketNumber: ticket.ticketNumber }, 'Fallo al imprimir ticket');
      reply.status(502).send({
        code: 'PRINT_FAILED',
        message: 'No se pudo imprimir el ticket. Verifica la impresora e intenta de nuevo.',
      });
      return;
    }

    fastify.log.info({ ticketNumber: ticket.ticketNumber }, 'Ticket impreso');
    reply.status(200).send({ status: 'printed', ticketNumber: ticket.ticketNumber });
  });
}
