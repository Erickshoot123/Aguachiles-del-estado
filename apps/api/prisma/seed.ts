import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BASE_ROLES = ['admin', 'gerente', 'cajero'] as const;

const SEED_ADMIN_EMAIL = 'admin@aguachiles.local';
const SEED_ADMIN_PASSWORD = 'ChangeMe123!';

async function seedRoles(): Promise<Record<string, string>> {
  const roleIds: Record<string, string> = {};
  for (const name of BASE_ROLES) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    roleIds[name] = role.id;
  }
  return roleIds;
}

async function seedAdminUser(adminRoleId: string): Promise<void> {
  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: SEED_ADMIN_EMAIL },
    update: {},
    create: {
      name: 'Administrador',
      email: SEED_ADMIN_EMAIL,
      passwordHash,
      roleId: adminRoleId,
    },
  });
}

async function seedPaymentMethods(): Promise<void> {
  const methods = [
    { name: 'Efectivo', type: 'cash' as const },
    { name: 'Tarjeta', type: 'card' as const },
    { name: 'Transferencia', type: 'transfer' as const },
  ];
  for (const method of methods) {
    const existing = await prisma.paymentMethod.findFirst({ where: { name: method.name } });
    if (!existing) {
      await prisma.paymentMethod.create({ data: method });
    }
  }
}

const MENU_ITEMS = [
  { sku: 'AGU-CLASICO', name: 'Aguachile clásico', price: 180, cost: 95 },
  { sku: 'AGU-NEGRO', name: 'Aguachile negro', price: 195, cost: 105 },
  { sku: 'AGU-MANGO', name: 'Aguachile de mango', price: 190, cost: 100 },
  { sku: 'TOS-ATUN', name: 'Tostada de atún', price: 95, cost: 50 },
  { sku: 'CEV-VERDE', name: 'Ceviche verde', price: 165, cost: 85 },
  { sku: 'CALLO-HACHA', name: 'Callo de hacha', price: 220, cost: 130 },
  { sku: 'TOSTICEVICHE', name: 'Tosticeviche', price: 110, cost: 55 },
  { sku: 'AGUA-PEPINO', name: 'Agua de pepino', price: 45, cost: 15 },
  { sku: 'ORD-TOSTADAS', name: 'Orden de tostadas', price: 35, cost: 12 },
] as const;

const INITIAL_STOCK = 50;

async function seedMenu(): Promise<void> {
  const existingCategory = await prisma.category.findFirst({
    where: { name: 'Menú', parentId: null },
  });
  const category = existingCategory ?? (await prisma.category.create({ data: { name: 'Menú' } }));

  for (const item of MENU_ITEMS) {
    const product = await prisma.product.upsert({
      where: { sku: item.sku },
      update: {},
      create: {
        sku: item.sku,
        name: item.name,
        categoryId: category.id,
        price: item.price,
        cost: item.cost,
        unit: 'pieza',
      },
    });

    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {},
      create: { productId: product.id, quantity: INITIAL_STOCK, minStock: 5 },
    });
  }
}

async function main(): Promise<void> {
  const roleIds = await seedRoles();
  await seedAdminUser(roleIds['admin'] as string);
  await seedPaymentMethods();
  await seedMenu();

  console.warn(`Seed completado. Usuario admin: ${SEED_ADMIN_EMAIL} / ${SEED_ADMIN_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
