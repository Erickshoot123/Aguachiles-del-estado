import cors from '@fastify/cors';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { loadEnv } from './config/env.js';
import printRoutes from './print.routes.js';
import { PrinterSettings } from './printers/printerSettings.js';
import { printerSettingsRoutes } from './printerSettings.routes.js';
import { PrintActivity } from './printers/printActivity.js';

async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // Sin archivo .env (ej. producción con variables ya inyectadas): se usan
    // las variables de entorno del proceso tal cual.
  }
  const env = loadEnv();
  const app = Fastify({ logger: true });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'La solicitud no cumple con el esquema esperado',
        issues: error.issues,
      });
      return;
    }
    request.log.error(error);
    reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Error interno del print-agent' });
  });

  const settings = new PrinterSettings(env);
  await settings.initialize();
  await app.register(cors, {
    origin: env.PRINT_ALLOWED_ORIGINS.split(','),
    methods: ['GET', 'POST', 'PUT'],
  });
  await app.register(printerSettingsRoutes, { env, settings });
  const activity = new PrintActivity();
  await app.register(printRoutes, { env, activity });
  app.get('/health', async () => ({ status: 'ok' }));

  if (env.HOST !== '127.0.0.1') {
    app.log.warn(
      { host: env.HOST },
      'El Print Agent está escuchando fuera de localhost: cualquier equipo en esa red podrá pedirle imprimir.',
    );
  }
  await app.listen({ port: env.PORT, host: env.HOST });
  const shutdown = (): void => {
    void app.close();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  process.on('message', (message) => {
    if (message && typeof message === 'object' && 'type' in message && 'id' in message) {
      if (message.type === 'prepare-update')
        process.send?.({
          type: 'printer-update-result',
          id: message.id,
          ready: activity.prepare(),
        });
      if (message.type === 'resume-update') activity.paused = false;
    }
    if (message === 'shutdown') {
      shutdown();
      process.disconnect?.();
    }
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
