import cors from '@fastify/cors';
import Fastify from 'fastify';
import { loadEnv } from './config/env.js';
import printRoutes from './print.routes.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const app = Fastify({ logger: true });

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
