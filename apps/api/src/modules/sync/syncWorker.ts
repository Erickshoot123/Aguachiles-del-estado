import type { FastifyInstance } from 'fastify';
import type { Env } from '../../config/env.js';
import { flushOutbox, recordSyncFailure } from './send.repository.js';

export function registerSyncWorker(app: FastifyInstance, env: Env): void {
  if (env.POS_MODE !== 'local' || !env.SYNC_CENTRAL_URL || !env.SYNC_TOKEN) return;
  const destination = { url: env.SYNC_CENTRAL_URL, token: env.SYNC_TOKEN };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> = Promise.resolve();
  let stopped = false;
  let failures = 0;

  async function tick(): Promise<void> {
    let delay = env.SYNC_INTERVAL_MS;
    try {
      const more = await flushOutbox(app.prisma, destination);
      failures = 0;
      if (more) delay = 100;
    } catch (error) {
      failures += 1;
      delay = Math.min(env.SYNC_INTERVAL_MS * 2 ** Math.min(failures, 5), 300000);
      app.log.error({ err: error }, 'Falló la sincronización; se reintentará');
      try { await recordSyncFailure(app.prisma); }
      catch (storageError) { app.log.error({ err: storageError }, 'No se pudo registrar el estado de sincronización'); }
    }
    if (!stopped) timer = setTimeout(() => { running = tick(); }, delay);
  }
  app.addHook('onReady', async () => { timer = setTimeout(() => { running = tick(); }, 0); });
  app.addHook('preClose', async () => {
    stopped = true;
    clearTimeout(timer);
    await running;
  });
}
