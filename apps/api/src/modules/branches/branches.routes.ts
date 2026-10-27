import type { FastifyInstance, FastifyRequest } from 'fastify';
import { branchReportQuerySchema } from '@aguachiles/shared';
import { ForbiddenError } from '../../lib/errors.js';
import { getBranchReport } from './branches.service.js';

export async function registerBranchReportRoutes(app: FastifyInstance): Promise<void> {
  async function requireCentralAdmin(request: FastifyRequest): Promise<void> {
    const user = await app.prisma.user.findUnique({ where: { id: request.user.sub }, include: { role: true } });
    if (!user?.isActive || user.role.name !== 'admin') {
      throw new ForbiddenError('El panel central requiere una cuenta de administrador');
    }
  }
  app.get('/api/branches/report', { preHandler: [app.authenticate, requireCentralAdmin] }, async (request) =>
    getBranchReport(app.prisma, branchReportQuerySchema.parse(request.query)));
}
