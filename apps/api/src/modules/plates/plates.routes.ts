import type { FastifyInstance } from 'fastify';
import { adjustPlatesSchema, initializePlatesSchema } from '@aguachiles/shared';
import { requirePermission } from '../../lib/authorize.js';
import { adjustPlates, getPlateAvailability, initializePlates } from './plateDay.service.js';

export default async function platesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/plates/today', { preHandler: app.authenticate }, () => getPlateAvailability(app.prisma));
  app.post('/api/plates/today', { preHandler: app.authenticate }, (request) =>
    initializePlates(app.prisma, request.user.sub, initializePlatesSchema.parse(request.body)));
  app.patch('/api/plates/today', { preHandler: [app.authenticate, requirePermission('catalog.write')] }, (request) =>
    adjustPlates(app.prisma, request.user.sub, adjustPlatesSchema.parse(request.body)));
}
