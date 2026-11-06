import { syncAckSchema, type SyncBatch } from '@aguachiles/shared';

export interface SyncDestination { url: string; token: string }

export async function sendSyncBatch(destination: SyncDestination, installationId: string, batch: SyncBatch) {
  const response = await fetch(`${destination.url.replace(/\/$/, '')}/api/sync/ingest`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${destination.token}`,
      'x-installation-id': installationId }, body: JSON.stringify(batch),
  });
  if (!response.ok) throw new Error(`La central respondió HTTP ${response.status}`);
  const acknowledgment = syncAckSchema.parse(await response.json());
  const expected = new Set(batch.events.map((event) => event.sequence));
  if (acknowledgment.accepted.length !== expected.size ||
      new Set(acknowledgment.accepted).size !== expected.size ||
      acknowledgment.accepted.some((sequence) => !expected.has(sequence))) {
    throw new Error('La central no confirmó el lote completo');
  }
  return acknowledgment;
}
