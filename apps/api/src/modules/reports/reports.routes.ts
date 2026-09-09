import { salesReportQuerySchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { getCashSessionHistory, getSalesReport } from './reports.service.js';

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default async function reportsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/reports/sales',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const query = salesReportQuerySchema.parse(request.query);
      const from = query.from ? new Date(query.from) : startOfToday();
      const to = query.to ? new Date(query.to) : new Date();

      const report = await getSalesReport(fastify.prisma, from, to);
      reply.status(200).send(report);
    },
  );

  fastify.get(
    '/api/reports/cash-sessions',
    { preHandler: fastify.authenticate },
    async (_request, reply) => {
      const history = await getCashSessionHistory(fastify.prisma);
      reply.status(200).send(history);
    },
  );
}
