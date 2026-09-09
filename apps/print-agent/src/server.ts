import Fastify from 'fastify';
import { z } from 'zod';
import printRoutes from './print.routes.js';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
});

async function main(): Promise<void> {
  const env = envSchema.parse(process.env);
  const app = Fastify({ logger: true });

  await app.register(printRoutes);
  app.get('/health', async () => ({ status: 'ok' }));

  // Solo escucha en localhost: el Print Agent nunca debe exponerse a la red.
  await app.listen({ port: env.PORT, host: '127.0.0.1' });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
