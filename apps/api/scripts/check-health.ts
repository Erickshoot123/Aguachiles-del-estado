import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';

const checkEnvSchema = z.object({
  HEALTH_CHECK_URL: z.string().url().default('http://127.0.0.1:3000/health'),
  HEALTH_CHECK_LOG_FILE: z.string().min(1).default('./logs/health-check.log'),
  HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
});

async function logFailure(logFile: string, message: string): Promise<void> {
  await mkdir(dirname(logFile), { recursive: true });
  await appendFile(logFile, `[${new Date().toISOString()}] ${message}\n`);
}

async function main(): Promise<void> {
  const env = checkEnvSchema.parse(process.env);

  let response: Response;
  try {
    response = await fetch(env.HEALTH_CHECK_URL, { signal: AbortSignal.timeout(env.HEALTH_CHECK_TIMEOUT_MS) });
  } catch (error) {
    const message = `No se pudo contactar ${env.HEALTH_CHECK_URL}: ${String(error)}`;
    await logFailure(env.HEALTH_CHECK_LOG_FILE, message);
    console.error(message);
    process.exitCode = 1;
    return;
  }

  if (!response.ok) {
    const message = `${env.HEALTH_CHECK_URL} respondió con estado ${response.status}`;
    await logFailure(env.HEALTH_CHECK_LOG_FILE, message);
    console.error(message);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('Error al ejecutar el chequeo de salud:', error);
  process.exitCode = 1;
});
