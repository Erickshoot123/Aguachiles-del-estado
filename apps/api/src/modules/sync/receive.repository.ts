import { Prisma, type PrismaClient } from '@prisma/client';
import type { SyncBatch, SyncEvent } from '@aguachiles/shared';
import { ForbiddenError, UnauthorizedError } from '../../lib/errors.js';
import { matchesSyncToken } from './syncCredentials.js';

async function storeProjection(tx: Prisma.TransactionClient, installationId: string, event: SyncEvent) {
  const status = 'status' in event.payload ? event.payload.status : null;
  const paymentType = 'paymentType' in event.payload ? event.payload.paymentType : null;
  // El índice compuesto aísla los folios/UUID de cada instalación. El WHERE
  // evita regresiones incluso cuando el transporte repite o reordena lotes.
  await tx.$executeRaw`
    INSERT INTO sync_records (installation_id, kind, entity_id, sequence, payload,
      deleted, occurred_at, amount, status, payment_type)
    VALUES (${installationId}, ${event.kind}, ${event.entityId}, ${BigInt(event.sequence)},
      ${JSON.stringify(event.payload)}::jsonb, ${event.deleted},
      ${new Date(event.payload.occurredAt)}, ${new Prisma.Decimal(event.payload.amount)}, ${status}, ${paymentType})
    ON CONFLICT (installation_id, kind, entity_id) DO UPDATE SET
      sequence = EXCLUDED.sequence, payload = EXCLUDED.payload, deleted = EXCLUDED.deleted,
      occurred_at = EXCLUDED.occurred_at, amount = EXCLUDED.amount,
      status = EXCLUDED.status, payment_type = EXCLUDED.payment_type
    WHERE sync_records.sequence < EXCLUDED.sequence`;
}

export async function receiveBatch(db: PrismaClient, installationId: string, token: string, batch: SyncBatch) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sync_installations WHERE id = ${installationId} FOR UPDATE`;
    const installation = await tx.syncInstallation.findUnique({ where: { id: installationId } });
    if (!installation?.isActive || !matchesSyncToken(token, installation.tokenHash)) {
      throw new UnauthorizedError('Credenciales de sincronización inválidas');
    }
    if (batch.events.some((event) => event.locationId !== installation.sourceLocationId)) {
      throw new ForbiddenError('El lote contiene movimientos de otra sucursal');
    }
    for (const event of batch.events) await storeProjection(tx, installationId, event);
    const receivedAt = new Date();
    await tx.syncInstallation.update({ where: { id: installationId }, data: {
      lastSeenAt: receivedAt, pendingCount: batch.pendingCount,
    } });
    return { accepted: batch.events.map((event) => event.sequence), receivedAt: receivedAt.toISOString() };
  }, { timeout: 15000 });
}
