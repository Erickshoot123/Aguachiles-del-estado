import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp(env);
  const shutdown = (): void => {
    void app.close().catch((error: unknown) => {
      app.log.error({ err: error }, 'No se pudo cerrar el servidor correctamente');
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  process.on('message', (message) => {
    if (message === 'shutdown') { shutdown(); process.disconnect?.(); }
  });

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
