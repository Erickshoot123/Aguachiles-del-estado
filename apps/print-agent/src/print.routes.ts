import { printRequestSchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import type { Env } from './config/env.js';
import { PrinterNotFoundError } from './printers/printer.errors.js';
import { printTicket } from './printers/printJob.js';

export default async function printRoutes(
  fastify: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  fastify.get('/printers', async (_request, reply) => {
    reply.status(200).send(opts.env.PRINTERS.map(({ id, name }) => ({ id, name })));
  });

  fastify.post('/print', async (request, reply) => {
    const { ticket, printerId } = printRequestSchema.parse(request.body);

    try {
      await printTicket(ticket, opts.env, printerId);
    } catch (error) {
      if (error instanceof PrinterNotFoundError) {
        reply.status(400).send({ code: 'VALIDATION_ERROR', message: error.message });
        return;
      }
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
