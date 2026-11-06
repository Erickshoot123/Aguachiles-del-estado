import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { hashSyncToken } from '../src/modules/sync/syncCredentials.js';

const db = new PrismaClient();
const uuid = z.string().uuid();
function requireMode(mode: 'local' | 'central') {
  if ((process.env.POS_MODE ?? 'local') !== mode) throw new Error(`Este comando requiere POS_MODE=${mode}`);
}

async function register(args: string[]) {
  requireMode('central');
  const [name, sourceLocationId, timeZone] = z.tuple([z.string().min(1).max(100), uuid, z.string().min(1)]).parse(args);
  new Intl.DateTimeFormat('es-MX', { timeZone }).format();
  const zones = await db.$queryRaw<{ name: string }[]>`SELECT name FROM pg_timezone_names WHERE name = ${timeZone}`;
  if (!zones.length) throw new Error('PostgreSQL no reconoce esa zona horaria');
  const token = randomBytes(32).toString('hex');
  const installation = await db.syncInstallation.create({ data: { name, sourceLocationId, timeZone, tokenHash: hashSyncToken(token) } });
  process.stdout.write(`Instalación: ${installation.id}\nSYNC_TOKEN=${token}\nGuarda la credencial; no se almacena en texto plano en la central.\n`);
}

async function bind(args: string[]) {
  requireMode('local');
  const [locationId, installationId] = z.tuple([uuid, uuid]).parse(args);
  const existing = await db.localNode.findUnique({ where: { id: 'local' } });
  if (existing && (existing.locationId !== locationId || existing.installationId !== installationId)) {
    throw new Error('Esta base ya está vinculada. No cambies la identidad de una sucursal con historial.');
  }
  const location = await db.location.findUnique({ where: { id: locationId } });
  if (!location?.isActive) throw new Error('La sucursal indicada no existe o está inactiva');
  if (await db.syncOutbox.count({ where: { locationId: { not: locationId } } })) {
    throw new Error('La base contiene movimientos de otra sucursal; requiere una migración de datos supervisada');
  }
  await db.localNode.upsert({ where: { id: 'local' }, update: {}, create: { locationId, installationId } });
  process.stdout.write(`Sucursal vinculada: ${location.name}\n`);
}

async function changeCredential(command: string, args: string[]) {
  requireMode('central');
  const [id] = z.tuple([uuid]).parse(args);
  if (command === 'revoke') {
    await db.syncInstallation.update({ where: { id }, data: { isActive: false } });
    process.stdout.write('Instalación desactivada; su historial se conserva.\n');
  } else {
    const token = randomBytes(32).toString('hex');
    await db.syncInstallation.update({ where: { id }, data: { tokenHash: hashSyncToken(token), isActive: true } });
    process.stdout.write(`SYNC_TOKEN=${token}\nActualiza esta credencial en el servidor local.\n`);
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'register') return register(args);
  if (command === 'bind') return bind(args);
  if (command === 'rotate' || command === 'revoke') return changeCredential(command, args);
  if (command === 'locations') {
    requireMode('local');
    process.stdout.write(JSON.stringify(await db.location.findMany(), null, 2) + '\n');
    return;
  }
  throw new Error('Comandos: locations | register <nombre> <locationId> <zonaIANA> | bind <locationId> <installationId> | rotate/revoke <installationId>');
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudo completar la configuración');
  process.exitCode = 1;
}).finally(() => db.$disconnect());
