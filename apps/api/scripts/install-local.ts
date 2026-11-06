import { PrismaClient } from '@prisma/client';
import { bootstrapLocalInstallation, type BootstrapInput } from '../src/modules/installation/bootstrap.service.js';

const db = new PrismaClient();
try {
  let input = '';
  for await (const chunk of process.stdin) input += String(chunk);
  await bootstrapLocalInstallation(db, JSON.parse(input) as BootstrapInput);
  process.stdout.write('Instalación inicial preparada.\n');
} catch {
  process.stderr.write('No se pudo preparar la instalación. Verifica la base y las credenciales de administrador.\n');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
