import type { FastifyInstance } from 'fastify';
import type { Env } from './config/env.js';
import { PrinterSettings } from './printers/printerSettings.js';
import { printerSelectionSchema } from '@aguachiles/shared';

export async function printerSettingsRoutes(
  app: FastifyInstance,
  options: { env: Env; settings: PrinterSettings },
) {
  app.addHook('preHandler', async (request, reply) => {
    const origin = request.headers.origin;
    if (
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.ip) ||
      (origin && !options.env.PRINT_ALLOWED_ORIGINS.split(',').includes(origin))
    )
      return reply
        .code(403)
        .send({
          code: 'FORBIDDEN',
          message: 'Configura las impresoras desde el POS de esta computadora.',
        });
  });
  app.get('/printer-settings', () => options.settings.status());
  app.put('/printer-settings', async (request, reply) => {
    const selection = printerSelectionSchema.parse(request.body);
    try {
      await options.settings.save(selection);
    } catch (error) {
      return reply
        .code(400)
        .send({
          code: 'PRINTER_CONFIGURATION_ERROR',
          message: error instanceof Error ? error.message : 'No se pudo guardar la impresora.',
        });
    }
    return { status: 'saved' };
  });
}
