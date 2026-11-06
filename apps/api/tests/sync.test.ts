import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncEventSchema, type SyncEvent } from '@aguachiles/shared';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createOrder, chargeOrder } from '../src/modules/orders/orders.service.js';
import { openSession, closeSession } from '../src/modules/cash/cash.service.js';
import { createRefund } from '../src/modules/refunds/refunds.service.js';
import { hashSyncToken } from '../src/modules/sync/syncCredentials.js';
import { flushOutbox } from '../src/modules/sync/send.repository.js';
import { receiveBatch } from '../src/modules/sync/receive.repository.js';
import { getBranchReport } from '../src/modules/branches/branches.service.js';
import { resetDatabase, testPrisma as db, disconnectTestDb, TEST_DATABASE_URL } from './testDb.js';
import { seedBaseFixtures, createTestProduct, type BaseFixtures } from './fixtures.js';
import { loginAs, authHeader } from './testApp.js';

describe('sincronización local → central', () => {
  let central: FastifyInstance;
  let url: string;
  let fixtures: BaseFixtures;
  let installationId: string;
  let userId: string;
  const token = 'sync-test-token-with-at-least-32-characters';

  beforeAll(async () => {
    central = await buildApp({ ...loadEnv(), POS_MODE: 'central' });
    url = await central.listen({ host: '127.0.0.1', port: 0 });
  });
  afterAll(async () => { vi.restoreAllMocks(); await central.close(); await disconnectTestDb(); });
  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDatabase();
    fixtures = await seedBaseFixtures(db);
    const user = await db.user.findUniqueOrThrow({ where: { username: fixtures.adminUsername } });
    userId = user.id;
    const installation = await db.syncInstallation.create({ data: {
      name: 'Centro', sourceLocationId: fixtures.locationId, timeZone: 'America/Mazatlan', tokenHash: hashSyncToken(token),
    } });
    installationId = installation.id;
    await db.localNode.create({ data: { locationId: fixtures.locationId, installationId } });
  });

  async function paidOrder() {
    const product = await createTestProduct(db, { price: 100 });
    const session = await openSession(db, userId, fixtures.cashRegisterId, 50);
    const order = await createOrder(db, userId, { channel: 'counter', items: [{ productId: product.id, quantity: 2 }] });
    await chargeOrder(db, order.id, userId, session.id, [
      { paymentMethodId: fixtures.cashPaymentMethodId, amount: 120 },
      { paymentMethodId: fixtures.cardPaymentMethodId, amount: 80 },
    ]);
    return { order, session };
  }

  function event(sequence: string, amount: string, entityId = randomUUID()): Extract<SyncEvent, { kind: 'payment' }> {
    return { kind: 'payment', sequence, entityId, locationId: fixtures.locationId, deleted: false,
      payload: { saleId: randomUUID(), paymentType: 'cash', amount, occurredAt: '2026-01-02T01:00:00.000Z' } };
  }
  async function receive(events: SyncEvent[]) {
    return receiveBatch(db, installationId, token, { protocolVersion: 1, events, pendingCount: 0 });
  }

  it('conserva pagos, devolución y cierre después de una caída y del reinicio del cliente', async () => {
    const { order, session } = await paidOrder();
    await createRefund(db, order.id, userId, session.id, { cashRegisterId: fixtures.cashRegisterId,
      reason: 'Prueba', items: [{ saleItemId: order.items[0]!.id, quantity: 1 }] });
    await closeSession(db, session.id, userId, 70);
    const destination = { url, token };
    await expect(flushOutbox(db, { ...destination, url: 'http://127.0.0.1:1' })).rejects.toThrow();
    expect(await db.syncOutbox.count({ where: { sentAt: null } })).toBeGreaterThan(0);
    const restarted = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    try { await flushOutbox(restarted, destination); } finally { await restarted.$disconnect(); }
    expect(await db.syncOutbox.count({ where: { sentAt: null } })).toBe(0);
    const year = new Date().getUTCFullYear();
    const report = await getBranchReport(db, { from: `${year}-01-01`, to: `${year}-12-31` });
    expect(report.branches[0]).toMatchObject({ grossSales: '200.00', refunds: '100.00', netSales: '100.00',
      tickets: 1, openSessions: 0, payments: { cash: '120.00', card: '80.00' } });
    const closing = await db.syncRecord.findFirstOrThrow({ where: { kind: 'cashSession' } });
    expect(closing.payload).toMatchObject({ status: 'closed', actualAmount: '70.00', difference: '0.00' });
  });

  it('reenvía sin duplicar cuando la central confirmó pero se perdió la respuesta', async () => {
    await paidOrder();
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (...args) => {
      await realFetch(...args);
      throw new Error('Respuesta perdida');
    });
    await expect(flushOutbox(db, { url, token })).rejects.toThrow();
    const count = await db.syncRecord.count();
    vi.restoreAllMocks();
    await flushOutbox(db, { url, token });
    expect(await db.syncRecord.count()).toBe(count);
    expect(await db.syncOutbox.count({ where: { sentAt: null } })).toBe(0);
  });

  it('ignora versiones antiguas y repetidas; conserva tombstones', async () => {
    const newest = event('20', '250.25');
    await receive([newest]);
    await receive([{ ...newest, sequence: '10', payload: { ...newest.payload, amount: '1.00' } }]);
    await receive([newest]);
    expect((await db.syncRecord.findFirstOrThrow()).amount.toFixed(2)).toBe('250.25');
    await receive([{ ...newest, sequence: '21', deleted: true }]);
    await receive([newest]);
    expect((await db.syncRecord.findFirstOrThrow()).deleted).toBe(true);
  });

  it('revierte el lote completo si contiene movimientos de otra sucursal', async () => {
    await expect(receive([event('1', '10.00'), { ...event('2', '20.00'), locationId: randomUUID() }])).rejects.toThrow();
    expect(await db.syncRecord.count()).toBe(0);
  });

  it('rechaza credenciales incorrectas y revocadas', async () => {
    const batch = { protocolVersion: 1 as const, events: [event('1', '10.00')], pendingCount: 0 };
    await expect(receiveBatch(db, installationId, 'incorrecta', batch)).rejects.toThrow();
    await db.syncInstallation.update({ where: { id: installationId }, data: { isActive: false } });
    await expect(receiveBatch(db, installationId, token, batch)).rejects.toThrow();
    expect(await db.syncRecord.count()).toBe(0);
  });

  it('usa el día local de la sucursal para los reportes', async () => {
    await receive([event('1', '25.30')]); // UTC 2 de enero; Mazatlán 1 de enero.
    const first = await getBranchReport(db, { from: '2026-01-01', to: '2026-01-01' });
    const second = await getBranchReport(db, { from: '2026-01-02', to: '2026-01-02' });
    expect(first.branches[0]?.grossSales).toBe('25.30');
    expect(second.branches[0]?.grossSales).toBe('0.00');
  });

  it('la central no expone cobros y solo el administrador puede consultar sucursales', async () => {
    const admin = await loginAs(central, fixtures.adminUsername);
    const cashier = await loginAs(central, fixtures.cajeroUsername);
    const route = '/api/branches/report?from=2026-01-01&to=2026-01-02';
    expect((await central.inject({ url: route, headers: authHeader(admin) })).statusCode).toBe(200);
    expect((await central.inject({ url: route, headers: authHeader(cashier) })).statusCode).toBe(403);
    expect((await central.inject({ url: route })).statusCode).toBe(401);
    expect((await central.inject({ method: 'POST', url: '/api/orders', headers: authHeader(admin), payload: {} })).statusCode).toBe(404);
  });

  it('no registra eventos de una transacción revertida ni datos privados del cliente', async () => {
    const { order } = await paidOrder();
    const before = await db.syncOutbox.count();
    await expect(db.$transaction(async (tx) => {
      await tx.sale.update({ where: { id: order.id }, data: { notes: 'privado' } });
      throw new Error('Rollback');
    })).rejects.toThrow('Rollback');
    expect(await db.syncOutbox.count()).toBe(before);
    for (const row of await db.syncOutbox.findMany()) {
      const parsed = syncEventSchema.parse({ ...row, sequence: row.sequence.toString() });
      expect(parsed.payload).not.toHaveProperty('customerPhone');
      expect(parsed.payload).not.toHaveProperty('notes');
    }
  });

  it('aísla dos sucursales aunque tengan el mismo UUID de origen', async () => {
    const payment = event('1', '10.50');
    await receive([payment]);
    const otherLocation = randomUUID();
    const other = await db.syncInstallation.create({ data: { name: 'Norte', sourceLocationId: otherLocation,
      timeZone: 'America/Mazatlan', tokenHash: hashSyncToken(token) } });
    await receiveBatch(db, other.id, token, { protocolVersion: 1, pendingCount: 0,
      events: [{ ...payment, locationId: otherLocation, payload: { ...payment.payload, amount: '20.25' } }] });
    const report = await getBranchReport(db, { from: '2026-01-01', to: '2026-01-01' });
    expect(report.branches.map((branch) => branch.grossSales)).toEqual(['10.50', '20.25']);
    expect((await getBranchReport(db, { from: '2026-01-01', to: '2026-01-01', installationId: other.id })).branches).toHaveLength(1);
  });

  it('drena más de un lote sin perder movimientos pendientes', async () => {
    const payment = event('1', '1.00');
    await db.syncOutbox.createMany({ data: Array.from({ length: 105 }, () => ({
      kind: 'payment', entityId: randomUUID(), locationId: fixtures.locationId, payload: payment.payload,
    })) });
    expect(await flushOutbox(db, { url, token })).toBe(true);
    expect(await db.syncOutbox.count({ where: { sentAt: null } })).toBe(5);
    expect(await flushOutbox(db, { url, token })).toBe(false);
    expect(await db.syncRecord.count()).toBe(105);
  });

  it('envía una secuencia menor que confirmó después de otra mayor', async () => {
    let release!: () => void;
    let ready!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const inserted = new Promise<void>((resolve) => { ready = resolve; });
    const first = event('1', '10.00');
    const transaction = db.$transaction(async (tx) => {
      await tx.syncOutbox.create({ data: { kind: first.kind, entityId: first.entityId,
        locationId: first.locationId, payload: first.payload } });
      ready();
      await gate;
    }, { timeout: 10000 });
    await inserted;
    try {
      const second = event('2', '20.00');
      await db.syncOutbox.create({ data: { kind: second.kind, entityId: second.entityId,
        locationId: second.locationId, payload: second.payload } });
      await flushOutbox(db, { url, token });
      expect(await db.syncRecord.count()).toBe(1);
    } finally { release(); await transaction; }
    await flushOutbox(db, { url, token });
    expect(await db.syncRecord.count()).toBe(2);
    expect(await db.syncOutbox.count({ where: { sentAt: null } })).toBe(0);
  });

  it('el servidor local sincroniza automáticamente sin un navegador abierto', async () => {
    await paidOrder();
    const local = await buildApp({ ...loadEnv(), POS_MODE: 'local', SYNC_CENTRAL_URL: url,
      SYNC_TOKEN: token, SYNC_INTERVAL_MS: 1000 });
    try {
      await local.ready();
      await vi.waitFor(async () => {
        expect(await db.syncOutbox.count({ where: { sentAt: null } })).toBe(0);
        expect(await db.syncRecord.count()).toBeGreaterThan(0);
      }, { timeout: 5000, interval: 100 });
    } finally { await local.close(); }
  });
});
