import { randomUUID, createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { test, expect } from '@playwright/test';

const databaseUrl = process.env.E2E_CENTRAL_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/aguachiles_central_e2e';
if (new URL(databaseUrl).pathname !== '/aguachiles_central_e2e') throw new Error('Base E2E central inválida');
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const username = `central-${randomUUID()}`;
const password = 'CentralTestPassword123!';
const token = 'central-e2e-branch-token-32-characters-minimum';
const branchName = `Sucursal Centro ${randomUUID().slice(0, 6)}`;
let installationId: string;
const locationId = randomUUID();
const saleId = randomUUID();

test.beforeAll(async ({ request }) => {
  const role = await db.role.upsert({ where: { name: 'admin' }, update: {}, create: { name: 'admin' } });
  await db.user.create({ data: { username, name: 'Administrador', roleId: role.id, passwordHash: await bcrypt.hash(password, 4) } });
  const installation = await db.syncInstallation.create({ data: { name: branchName, sourceLocationId: locationId,
    timeZone: 'America/Mazatlan', tokenHash: createHash('sha256').update(token).digest('hex') } });
  installationId = installation.id;
  const response = await request.post('http://127.0.0.1:3200/api/sync/ingest', {
    headers: { authorization: `Bearer ${token}`, 'x-installation-id': installationId },
    data: { protocolVersion: 1, pendingCount: 0, events: [{
      kind: 'payment', sequence: '1', entityId: randomUUID(), locationId, deleted: false,
      payload: { saleId, amount: '149.50', paymentType: 'cash', occurredAt: '2026-01-15T18:00:00Z' },
    }, {
      kind: 'sale', sequence: '2', entityId: saleId, locationId, deleted: false,
      payload: { ticketNumber: '#1', status: 'completed', amount: '149.50', occurredAt: '2026-01-15T18:00:00Z' },
    }, {
      kind: 'cashSession', sequence: '3', entityId: randomUUID(), locationId, deleted: false,
      payload: { registerId: randomUUID(), status: 'closed', amount: '20.00', occurredAt: '2026-01-15T14:00:00Z',
        closedAt: '2026-01-15T23:00:00Z', expectedAmount: '169.50', actualAmount: '169.50', difference: '0.00' },
    }] },
  });
  expect(response.ok()).toBeTruthy();
});
test.afterAll(async () => {
  await db.syncRecord.deleteMany({ where: { installationId } });
  await db.syncInstallation.deleteMany({ where: { id: installationId } });
  await db.user.deleteMany({ where: { username } });
  await db.$disconnect();
});

test('consulta ventas recibidas y filtra la sucursal en escritorio y móvil', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByLabel('Usuario').fill(username);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ventas por sucursal' })).toBeVisible();
  await page.getByLabel('Desde', { exact: true }).fill('2026-01-15');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-01-15');
  await page.getByLabel('Sucursal', { exact: true }).selectOption(installationId);
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: branchName }) });
  await expect(card).toContainText('$149.50');
  await expect(card).toContainText('Actualizada');
  await card.getByText('Últimos 5 cierres (todos los periodos)').click();
  await expect(card).toContainText('Contado: $169.50');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('central.png'), fullPage: true });
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByLabel('Usuario')).toBeVisible();
});
