import { PrismaClient } from '@prisma/client';

export const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/aguachiles_pos_test';

export const testPrisma = new PrismaClient({
  datasources: { db: { url: TEST_DATABASE_URL } },
});

// TRUNCATE ... CASCADE arrastra cualquier tabla dependiente aunque no esté
// listada aquí, así que el orden de esta lista no importa para las FKs; solo
// se listan las tablas "raíz" para que quede claro qué se está limpiando.
const TABLES_TO_RESET = [
  'refresh_tokens',
  'audit_logs',
  'refunds',
  'sales',
  'inventory_movements',
  'inventory',
  'products',
  'categories',
  'cash_movements',
  'cash_register_sessions',
  'cash_registers',
  'locations',
  'suppliers',
  'users',
  'role_permissions',
  'permissions',
  'roles',
  'payment_methods',
];

export async function resetDatabase(): Promise<void> {
  const tableList = TABLES_TO_RESET.map((table) => `"${table}"`).join(', ');
  await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
}

export async function disconnectTestDb(): Promise<void> {
  await testPrisma.$disconnect();
}
