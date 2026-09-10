import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../lib/authorize.js';
import { listAuditLogs } from './audit.service.js';

export default async function auditRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/audit-logs',
    { preHandler: [fastify.authenticate, requirePermission('audit.view')] },
    async (_request, reply) => {
      reply.status(200).send(await listAuditLogs(fastify.prisma));
    },
  );
}
