import { printDispatchRequestSchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { ValidationError } from '../../lib/errors.js';
import { idParamSchema } from '../../lib/paramsSchemas.js';
import { dispatchPrint } from './printDispatch.service.js';
import { PrintDispatchFailedError } from './receipts.errors.js';
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

  // Modos "red" y "otra_terminal": el navegador no puede abrir un socket TCP
  // crudo ni siempre puede llegar al Print Agent de otra terminal, así que
  // es el backend quien envía el ticket. El modo "agente_local" no pasa por
  // aquí: el navegador de esa terminal llama directo a su Print Agent.
  fastify.post(
    '/api/orders/:id/receipt/print',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const { target, printerId } = printDispatchRequestSchema.parse(request.body);

      if (target.mode === 'agente_local') {
        throw new ValidationError(
          'El modo "agente_local" se imprime directo desde el navegador, no vía backend',
        );
      }

      const { ticket } = await getReceiptTicket(fastify.prisma, id);

      try {
        await dispatchPrint(ticket, target, printerId);
      } catch (error) {
        request.log.error({ err: error, saleId: id, target }, 'Fallo al imprimir ticket remoto');
        throw new PrintDispatchFailedError();
      }

      await recordPrinted(fastify.prisma, id);
      reply.status(200).send({ status: 'printed' });
    },
  );
}
