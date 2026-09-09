import cors from '@fastify/cors';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { loadEnv } from './config/env.js';
import printRoutes from './print.routes.js';

async function main(): Promise<void> {
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

  await app.register(cors, { origin: true });
  await app.register(printRoutes, { env });
  app.get('/health', async () => ({ status: 'ok' }));

  // Solo escucha en localhost: el Print Agent nunca debe exponerse a la red.
  await app.listen({ port: env.PORT, host: '127.0.0.1' });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
