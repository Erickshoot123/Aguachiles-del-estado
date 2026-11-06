import type { PrismaClient } from '@prisma/client';
import { syncEventSchema } from '@aguachiles/shared';
import { sendSyncBatch, type SyncDestination } from './syncTransport.js';

export async function flushOutbox(db: PrismaClient, destination: SyncDestination): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(7362911) AS acquired`;
    if (!lock?.acquired) return false;
    const node = await tx.localNode.findUnique({ where: { id: 'local' }, include: { location: true } });
    if (!node?.location.isActive) throw new Error('Configura una sucursal local activa antes de sincronizar');
    const rows = await tx.syncOutbox.findMany({ where: { sentAt: null }, orderBy: { sequence: 'asc' }, take: 100 });
    const events = rows.map((row) => syncEventSchema.parse({ ...row, sequence: row.sequence.toString() }));
    if (events.some((event) => event.locationId !== node.locationId)) {
      throw new Error('Hay movimientos de otra sucursal en la cola local');
    }
    const pendingCount = await tx.syncOutbox.count({ where: { sentAt: null } });
    await sendSyncBatch(destination, node.installationId, {
      protocolVersion: 1, events, pendingCount: Math.max(0, pendingCount - events.length),
    });
    const sentAt = new Date();
    await tx.syncOutbox.updateMany({ where: { sequence: { in: rows.map((row) => row.sequence) } }, data: { sentAt } });
    await tx.localNode.update({ where: { id: 'local' }, data: { lastSuccessAt: sentAt, lastError: null } });
    return pendingCount > events.length;
  }, { timeout: 20000 });
}

export async function recordSyncFailure(db: PrismaClient): Promise<void> {
  await db.localNode.updateMany({ where: { id: 'local' }, data: {
    lastError: 'No se pudo sincronizar. Los movimientos siguen guardados; revisa conexión y configuración.',
  } });
}
