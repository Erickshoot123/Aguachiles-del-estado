import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { getLocalLocation } from '../locations/localLocation.repository.js';

export const DELIVERY_DURATION_MS = 25 * 60 * 1000;
export const deliveryDeadline = (now = new Date()): Date => new Date(now.getTime() + DELIVERY_DURATION_MS);

export async function completeDueDeliveries(db: PrismaClient, now = new Date()): Promise<number> {
  const location = await getLocalLocation(db);
  const result = await db.sale.updateMany({
    where: { locationId: location.id, channel: 'delivery', fulfillmentStatus: 'in_delivery',
      status: { not: 'cancelled' }, deliveryDueAt: { lte: now } },
    data: { fulfillmentStatus: 'delivered', deliveryDueAt: null },
  });
  return result.count;
}

export function registerDeliveryCompletion(app: FastifyInstance): void {
  let active: Promise<void> | undefined;
  const tick = (): void => {
    if (active) return;
    active = completeDueDeliveries(app.prisma).then(() => undefined).catch((error: unknown) => {
      app.log.error({ err: error }, 'No se pudieron finalizar las entregas; se reintentará');
    }).finally(() => { active = undefined; });
  };
  const timer = setInterval(tick, 15000);
  timer.unref();
  app.addHook('onReady', async () => { tick(); await active; });
  app.addHook('onClose', async () => { clearInterval(timer); await active; });
}
