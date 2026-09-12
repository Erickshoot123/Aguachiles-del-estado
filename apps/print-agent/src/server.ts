import cors from '@fastify/cors';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { loadEnv } from './config/env.js';
import printRoutes from './print.routes.js';

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

  await app.register(cors, { origin: true });
  await app.register(printRoutes, { env });
  app.get('/health', async () => ({ status: 'ok' }));

  if (env.HOST !== '127.0.0.1') {
    app.log.warn(
      { host: env.HOST },
      'El Print Agent está escuchando fuera de localhost: cualquier equipo en esa red podrá pedirle imprimir.',
    );
  }
  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
