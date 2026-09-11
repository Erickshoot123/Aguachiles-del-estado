import { execFile } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const backupEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  BACKUP_CONTAINER: z.string().min(1).default('aguachiles-postgres'),
  BACKUP_DIR: z.string().min(1).default('./backups'),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

function parseDbConnection(databaseUrl: string): { user: string; database: string } {
  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\//, '');
  if (!url.username || !database) {
    throw new Error('DATABASE_URL debe incluir usuario y nombre de base de datos');
  }
  return { user: url.username, database };
}

function timestampForFilename(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function dumpDatabase(
  container: string,
  user: string,
  database: string,
  outputPath: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = execFile(
      'docker',
      ['exec', container, 'pg_dump', '-U', user, '-Fc', database],
      { maxBuffer: 1024 * 1024 * 1024, encoding: 'buffer' },
    );
    const out = createWriteStream(outputPath);
    child.stdout?.pipe(out);

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pg_dump salió con código ${code}: ${stderr}`));
      }
    });
  });
}

async function deleteOldBackups(dir: string, retentionDays: number): Promise<string[]> {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await readdir(dir);
  const deleted: string[] = [];

  for (const entry of entries) {
    if (!entry.startsWith('aguachiles_pos_') || !entry.endsWith('.dump')) continue;
    const fullPath = join(dir, entry);
    const info = await stat(fullPath);
    if (info.mtimeMs < cutoff) {
      await unlink(fullPath);
      deleted.push(entry);
    }
  }

  return deleted;
}

async function main(): Promise<void> {
  const env = backupEnvSchema.parse(process.env);
  const { user, database } = parseDbConnection(env.DATABASE_URL);

  await mkdir(env.BACKUP_DIR, { recursive: true });

  const filename = `aguachiles_pos_${timestampForFilename(new Date())}.dump`;
  const outputPath = join(env.BACKUP_DIR, filename);

  await dumpDatabase(env.BACKUP_CONTAINER, user, database, outputPath);
  console.warn(`Respaldo creado: ${outputPath}`);

  const deleted = await deleteOldBackups(env.BACKUP_DIR, env.BACKUP_RETENTION_DAYS);
  if (deleted.length > 0) {
    console.warn(`Respaldos eliminados por retención (> ${env.BACKUP_RETENTION_DAYS} días): ${deleted.join(', ')}`);
  }
}

main().catch((error: unknown) => {
  console.error('Error al respaldar la base de datos:', error);
  process.exitCode = 1;
});
