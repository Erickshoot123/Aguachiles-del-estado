import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { z } from 'zod';

const restoreEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  BACKUP_CONTAINER: z.string().min(1).default('aguachiles-postgres'),
});

function parseDbConnection(databaseUrl: string): { user: string; database: string } {
  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\//, '');
  if (!url.username || !database) {
    throw new Error('DATABASE_URL debe incluir usuario y nombre de base de datos');
  }
  return { user: url.username, database };
}

async function restoreDatabase(
  container: string,
  user: string,
  database: string,
  dumpPath: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = execFile('docker', [
      'exec',
      '-i',
      container,
      'pg_restore',
      '-U',
      user,
      '-d',
      database,
      '--clean',
      '--if-exists',
    ]);

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pg_restore salió con código ${code}: ${stderr}`));
      }
    });

    createReadStream(dumpPath).pipe(child.stdin!);
  });
}

async function main(): Promise<void> {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    throw new Error('Uso: tsx scripts/restore-db.ts <ruta-al-archivo.dump>');
  }

  const env = restoreEnvSchema.parse(process.env);
  const { user, database } = parseDbConnection(env.DATABASE_URL);

  console.warn(`Restaurando "${database}" desde ${dumpPath}. Esto reemplaza los datos actuales.`);
  await restoreDatabase(env.BACKUP_CONTAINER, user, database, dumpPath);
  console.warn('Restauración completada.');
}

main().catch((error: unknown) => {
  console.error('Error al restaurar la base de datos:', error);
  process.exitCode = 1;
});
