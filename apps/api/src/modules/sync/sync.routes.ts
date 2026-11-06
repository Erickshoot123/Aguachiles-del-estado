import type { FastifyInstance } from 'fastify';
import { syncBatchSchema, type SyncStatus } from '@aguachiles/shared';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { receiveBatch } from './receive.repository.js';
import { getLocalLocation } from '../locations/localLocation.repository.js';

export async function registerSyncRoutes(app: FastifyInstance, env: Env): Promise<void> {
  app.get('/api/sync/status', { preHandler: app.authenticate }, async (): Promise<SyncStatus> => {
    if (env.POS_MODE === 'central') return { mode: 'central', enabled: true, locationName: null,
      pendingCount: 0, lastSuccessAt: null, lastError: null };
    const node = await app.prisma.localNode.findUnique({ where: { id: 'local' } });
    const location = await getLocalLocation(app.prisma);
    return { mode: 'local', locationName: location.name, enabled: !!env.SYNC_CENTRAL_URL && !!node,
      pendingCount: await app.prisma.syncOutbox.count({ where: { sentAt: null } }),
      lastSuccessAt: node?.lastSuccessAt?.toISOString() ?? null, lastError: node?.lastError ?? null };
  });
  if (env.POS_MODE !== 'central') return;
  app.post('/api/sync/ingest', { bodyLimit: 512000, config: { rateLimit: { max: 600, timeWindow: 60000 } } },
    async (request) => {
      const installationId = z.string().uuid().parse(request.headers['x-installation-id']);
      const authorization = request.headers.authorization;
      if (!authorization?.startsWith('Bearer ') || authorization.length > 300) {
        throw new UnauthorizedError('Se requiere una credencial de instalación');
      }
      return receiveBatch(app.prisma, installationId, authorization.slice(7), syncBatchSchema.parse(request.body));
    });
}
