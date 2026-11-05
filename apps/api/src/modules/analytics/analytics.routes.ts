import { localMidnight, nextDay } from './period.js';
import { z } from 'zod';
import { getOperationalAnalytics } from './operational.service.js';
import { salesReportQuerySchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../lib/authorize.js';
import { getAnalyticsDashboard } from './analytics.service.js';

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/analytics/operations',
    { preHandler: [fastify.authenticate, requirePermission('reports.view')] },
    async (request) => {
      const day = z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .refine((value) => {
          const date = new Date(value + 'T00:00:00Z');
          return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
        });
      const query = z
        .object({ from: day, to: day })
        .refine((value) => value.from <= value.to, 'El rango de fechas es inválido')
        .parse(request.query);
      return getOperationalAnalytics(
        fastify.prisma,
        localMidnight(query.from, process.env.POS_TIME_ZONE ?? 'America/Mazatlan'),
        localMidnight(nextDay(query.to), process.env.POS_TIME_ZONE ?? 'America/Mazatlan'),
      );
    },
  );
  fastify.get(
    '/api/analytics/dashboard',
    { preHandler: [fastify.authenticate, requirePermission('reports.view')] },
    async (request, reply) => {
      const query = salesReportQuerySchema.parse(request.query);
      const from = query.from ? new Date(query.from) : startOfToday();
      const to = query.to ? new Date(query.to) : new Date();

      const dashboard = await getAnalyticsDashboard(fastify.prisma, from, to);
      reply.status(200).send(dashboard);
    },
  );
}
