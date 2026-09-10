import { salesReportQuerySchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { getAnalyticsDashboard } from './analytics.service.js';

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/analytics/dashboard',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const query = salesReportQuerySchema.parse(request.query);
      const from = query.from ? new Date(query.from) : startOfToday();
      const to = query.to ? new Date(query.to) : new Date();

      const dashboard = await getAnalyticsDashboard(fastify.prisma, from, to);
      reply.status(200).send(dashboard);
    },
  );
}
