import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const db = new PrismaClient();
async function main() {
  if (process.env.POS_MODE !== 'central') throw new Error('Requiere POS_MODE=central');
  const username = z.string().min(1).parse(process.argv[2]);
  const password = z.string().min(12).parse(process.env.CENTRAL_ADMIN_PASSWORD);
  const passwordHash = await bcrypt.hash(password, 12);
  await db.$transaction(async (tx) => {
    const role = await tx.role.upsert({ where: { name: 'admin' }, update: {}, create: { name: 'admin' } });
    for (const code of ['reports.view', 'users.manage']) {
      const permission = await tx.permission.upsert({ where: { code }, update: {}, create: { code } });
      await tx.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {}, create: { roleId: role.id, permissionId: permission.id } });
    }
    await tx.user.create({ data: { username, name: username, passwordHash, roleId: role.id } });
  });
  process.stdout.write('Administrador central creado.\n');
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudo crear el administrador');
  process.exitCode = 1;
}).finally(() => db.$disconnect());
