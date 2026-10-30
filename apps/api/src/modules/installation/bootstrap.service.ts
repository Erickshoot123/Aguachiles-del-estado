import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { PERMISSION_DESCRIPTIONS } from '@aguachiles/shared';
import { MAIN_DISHES, COMPLEMENTS } from '../../../prisma/menu.js';

export interface BootstrapInput { locationName: string; adminUsername: string; adminPassword: string }

/** Solo inicializa una base vacía. Nunca resetea usuarios o datos de una instalación existente. */
export async function bootstrapLocalInstallation(db: PrismaClient, input: BootstrapInput): Promise<void> {
  if (!input.locationName.trim() || !/^[a-zA-Z0-9._-]{3,40}$/.test(input.adminUsername) || input.adminPassword.length < 12) {
    throw new Error('Ingresa sucursal, usuario (3–40 letras, números, punto o guion) y contraseña de al menos 12 caracteres.');
  }
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(728953221)`;
    if (await tx.user.count()) {
      const user = await tx.user.findUnique({ where: { username: input.adminUsername }, include: { role: true } });
      if (!user?.isActive || user.role.name !== 'admin' || !await bcrypt.compare(input.adminPassword, user.passwordHash)) {
        throw new Error('Esta base ya tiene usuarios. Usa las credenciales del administrador existente.');
      }
      return;
    }
    const roles: Record<string, string> = {};
    for (const name of ['admin', 'gerente', 'cajero']) {
      roles[name] = (await tx.role.upsert({ where: { name }, update: {}, create: { name } })).id;
    }
    for (const [code, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
      const permission = await tx.permission.upsert({ where: { code }, update: {}, create: { code, description } });
      for (const name of ['admin', 'gerente']) {
        const roleId = roles[name]!;
        await tx.rolePermission.upsert({ where: { roleId_permissionId: { roleId, permissionId: permission.id } },
          update: {}, create: { roleId, permissionId: permission.id } });
      }
    }
    await tx.user.create({ data: { username: input.adminUsername, name: 'Administrador',
      roleId: roles.admin!, passwordHash: await bcrypt.hash(input.adminPassword, 12) } });
    const activeLocations = await tx.location.findMany({ where: { isActive: true }, take: 2 });
    if (activeLocations.length > 1) throw new Error('La base ya tiene varias sucursales. Revisa su vinculación antes de instalar.');
    const location = activeLocations[0]
      ? await tx.location.update({ where: { id: activeLocations[0].id }, data: {
        name: input.locationName.trim(),
        // La migración antigua usa el mismo marcador en todas las bases; una sucursal nueva necesita identidad propia.
        ...(activeLocations[0].id === '00000000-0000-0000-0000-000000000001' ? { id: randomUUID() } : {}),
      } })
      : await tx.location.create({ data: { name: input.locationName.trim() } });
    await tx.cashRegister.create({ data: { name: 'Caja principal', locationId: location.id } });
    for (const method of [{ name: 'Efectivo', type: 'cash' }, { name: 'Tarjeta', type: 'card' }, { name: 'Transferencia', type: 'transfer' }] as const) {
      await tx.paymentMethod.create({ data: method });
    }
    for (const group of [{ name: 'Aguachiles', items: MAIN_DISHES, extra: false }, { name: 'Extras', items: COMPLEMENTS, extra: true }]) {
      const category = await tx.category.create({ data: { name: group.name } });
      for (const item of group.items) {
        await tx.product.create({ data: { sku: item.sku, name: item.name, price: item.price, cost: item.cost,
          unit: item.unit, categoryId: category.id, isComplement: group.extra,
          plateSize: item.unit === 'medio kilo' ? 'half_kilo' : item.unit === 'kilo' ? 'kilo' : null,
          inventory: { create: { quantity: 0 } } } });
      }
    }
  }, { timeout: 30000 });
}
