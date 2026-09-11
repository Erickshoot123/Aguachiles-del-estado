import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import type { PermissionCode } from '@aguachiles/shared';

export const TEST_PASSWORD = 'ChangeMe123!';

const ALL_PERMISSIONS: PermissionCode[] = [
  'refunds.create',
  'cash.withdraw',
  'catalog.write',
  'suppliers.write',
  'reports.view',
  'audit.view',
  'users.manage',
];

export interface BaseFixtures {
  roleIds: { admin: string; gerente: string; cajero: string };
  adminEmail: string;
  cajeroEmail: string;
  locationId: string;
  cashRegisterId: string;
  cashPaymentMethodId: string;
  cardPaymentMethodId: string;
}

/**
 * Siembra lo mínimo que casi cualquier prueba de integración necesita:
 * roles + permisos (igual que el seed real), un admin y un cajero con
 * contraseña conocida, una sucursal, una caja registradora y métodos de
 * pago. Cada prueba puede agregar sus propios productos/pedidos encima.
 */
export async function seedBaseFixtures(prisma: PrismaClient): Promise<BaseFixtures> {
  const roleNames = ['admin', 'gerente', 'cajero'] as const;
  const roleIds: Record<string, string> = {};
  for (const name of roleNames) {
    const role = await prisma.role.create({ data: { name } });
    roleIds[name] = role.id;
  }

  for (const code of ALL_PERMISSIONS) {
    const permission = await prisma.permission.create({ data: { code, description: code } });
    for (const roleName of ['admin', 'gerente'] as const) {
      await prisma.rolePermission.create({
        data: { roleId: roleIds[roleName] as string, permissionId: permission.id },
      });
    }
  }

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
  const adminEmail = 'admin@test.local';
  const cajeroEmail = 'cajero@test.local';
  await prisma.user.create({
    data: { name: 'Admin de prueba', email: adminEmail, passwordHash, roleId: roleIds['admin'] as string },
  });
  await prisma.user.create({
    data: { name: 'Cajero de prueba', email: cajeroEmail, passwordHash, roleId: roleIds['cajero'] as string },
  });

  const location = await prisma.location.create({ data: { name: 'Sucursal de prueba' } });
  const cashRegister = await prisma.cashRegister.create({
    data: { name: 'Caja de prueba', locationId: location.id },
  });

  const cash = await prisma.paymentMethod.create({ data: { name: 'Efectivo', type: 'cash' } });
  const card = await prisma.paymentMethod.create({ data: { name: 'Tarjeta', type: 'card' } });

  return {
    roleIds: { admin: roleIds['admin'] as string, gerente: roleIds['gerente'] as string, cajero: roleIds['cajero'] as string },
    adminEmail,
    cajeroEmail,
    locationId: location.id,
    cashRegisterId: cashRegister.id,
    cashPaymentMethodId: cash.id,
    cardPaymentMethodId: card.id,
  };
}

export interface TestProduct {
  id: string;
  sku: string;
  name: string;
  price: number;
  cost: number;
}

export async function createTestProduct(
  prisma: PrismaClient,
  overrides: Partial<{ sku: string; name: string; price: number; cost: number; stock: number }> = {},
): Promise<TestProduct> {
  const existingCategory = await prisma.category.findFirst({
    where: { name: 'Menú de prueba', parentId: null },
  });
  const category = existingCategory ?? (await prisma.category.create({ data: { name: 'Menú de prueba' } }));

  const sku = overrides.sku ?? `SKU-${Math.random().toString(36).slice(2, 10)}`;
  const price = overrides.price ?? 100;
  const cost = overrides.cost ?? 50;
  const product = await prisma.product.create({
    data: {
      sku,
      name: overrides.name ?? 'Producto de prueba',
      categoryId: category.id,
      price,
      cost,
      unit: 'pieza',
    },
  });
  await prisma.inventory.create({
    data: { productId: product.id, quantity: overrides.stock ?? 10 },
  });

  return { id: product.id, sku: product.sku, name: product.name, price, cost };
}
