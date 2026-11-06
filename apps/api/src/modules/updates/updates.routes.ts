import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePermission } from '../../lib/authorize.js';
import { ConflictError } from '../../lib/errors.js';
import { getLocalLocation } from '../locations/localLocation.repository.js';

const actionSchema = z.object({
  action: z.enum(['check', 'download', 'install']),
  confirmed: z.boolean().optional(),
});
const mutation = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method);
function requestSupervisor(action: string): Promise<Record<string, unknown>> {
  if (process.env.POS_DESKTOP_UPDATES !== '1' || !process.send || !process.connected)
    return Promise.resolve({
      phase: 'unavailable',
      message: 'Las actualizaciones se administran desde la aplicación de escritorio instalada.',
      installedVersion: null,
    });
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      process.off('message', receive);
    };
    const receive = (data: unknown) => {
      const message = data as {
        type?: string;
        id?: string;
        result?: Record<string, unknown>;
        error?: string;
      };
      if (message?.type !== 'update-result' || message.id !== id) return;
      cleanup();
      if (message.error) reject(new ConflictError(message.error));
      else resolve(message.result!);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new ConflictError('El servicio de actualizaciones no respondió. Inténtalo nuevamente.'),
      );
    }, 10000);
    process.on('message', receive);
    process.send!({ type: 'update-action', id, action }, (error: Error | null) => {
      if (error) {
        cleanup();
        reject(error);
      }
    });
  });
}
// Registrar directamente en app: el bloqueo debe cubrir todos los módulos, no solo estas rutas.
export type UpdateRequester = (action: string) => Promise<Record<string, unknown>>;
export function registerUpdateRoutes(
  app: FastifyInstance,
  requestUpdate: UpdateRequester = requestSupervisor,
): void {
  let maintenance = false;
  let inFlight = 0;
  const tracked = new WeakSet<object>();
  app.addHook('onRequest', async (request, reply) => {
    if (!mutation(request.method) || request.url.startsWith('/api/updates')) return;
    if (maintenance) {
      try {
        const state = await requestUpdate('status');
        if (state.phase === 'error' || state.phase === 'unavailable') maintenance = false;
      } catch {
        /* Conserva el bloqueo si no se pudo verificar el estado del actualizador. */
      }
    }
    if (maintenance)
      return reply.code(503).send({
        code: 'UPDATING',
        message: 'El POS está preparando una actualización. Espera a que reinicie.',
      });
    inFlight++;
    tracked.add(request);
  });
  app.addHook('onResponse', async (request) => {
    if (tracked.delete(request)) inFlight--;
  });
  const guards = [app.authenticate, requirePermission('users.manage')];
  app.get('/api/updates/status', { preHandler: guards }, async () => {
    const state = await requestUpdate('status');
    if (state.phase === 'error' || state.phase === 'unavailable') maintenance = false;
    return state;
  });
  app.post('/api/updates/action', { preHandler: guards }, async (request) => {
    const { action, confirmed } = actionSchema.parse(request.body);
    if (action !== 'install') return requestUpdate(action);
    if (!confirmed)
      throw new ConflictError('Confirma explícitamente la instalación y el reinicio del POS.');
    if (maintenance || inFlight)
      throw new ConflictError('Termina los cobros y movimientos en curso antes de instalar.');
    maintenance = true;
    try {
      const location = await getLocalLocation(app.prisma);
      if (
        await app.prisma.cashRegisterSession.count({
          where: { status: 'open', cashRegister: { locationId: location.id } },
        })
      )
        throw new ConflictError(
          'Cierra las cajas de esta sucursal antes de instalar la actualización.',
        );
      const state = await requestUpdate(action);
      if (state.phase !== 'installing') maintenance = false;
      return state;
    } catch (error) {
      maintenance = false;
      throw error;
    }
  });
}
