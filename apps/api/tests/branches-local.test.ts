import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, testPrisma as db, disconnectTestDb } from './testDb.js';
import { seedBaseFixtures, createTestProduct, type BaseFixtures } from './fixtures.js';
import { createOrder, chargeOrder, listActiveOrders } from '../src/modules/orders/orders.service.js';
import { openSession, listCashRegisters } from '../src/modules/cash/cash.service.js';

describe('identidad local e idempotencia', () => {
  let fixtures: BaseFixtures;
  let userId: string;
  beforeEach(async () => {
    await resetDatabase();
    fixtures = await seedBaseFixtures(db);
    userId = (await db.user.findUniqueOrThrow({ where: { username: fixtures.adminUsername } })).id;
  });
  afterAll(disconnectTestDb);

  it('reintentos simultáneos crean un solo pedido y rechaza reutilizar la clave con otro contenido', async () => {
    const product = await createTestProduct(db);
    const input = { clientRequestId: randomUUID(), channel: 'counter' as const, items: [{ productId: product.id, quantity: 1 }] };
    const orders = await Promise.all([createOrder(db, userId, input), createOrder(db, userId, input)]);
    expect(orders[0]?.id).toBe(orders[1]?.id);
    expect(await db.sale.count()).toBe(1);
    await expect(createOrder(db, userId, { ...input, items: [{ productId: product.id, quantity: 2 }] })).rejects.toThrow();
  });

  it('exige configurar la sucursal cuando hay más de una; después aísla las cajas', async () => {
    const other = await db.location.create({ data: { name: 'Otra' } });
    const register = await db.cashRegister.create({ data: { name: 'Caja otra', locationId: other.id } });
    await expect(listActiveOrders(db)).rejects.toThrow('Configura');
    await db.localNode.create({ data: { locationId: fixtures.locationId, installationId: randomUUID() } });
    expect((await listCashRegisters(db)).map((row) => row.id)).toEqual([fixtures.cashRegisterId]);
    await expect(openSession(db, userId, register.id, 0)).rejects.toThrow('sucursal');
  });

  it('dos cobros concurrentes solo generan un pago', async () => {
    const product = await createTestProduct(db);
    const order = await createOrder(db, userId, { channel: 'counter', items: [{ productId: product.id, quantity: 1 }] });
    const session = await openSession(db, userId, fixtures.cashRegisterId, 0);
    const payments = [{ paymentMethodId: fixtures.cashPaymentMethodId, amount: 100 }];
    const outcomes = await Promise.allSettled([
      chargeOrder(db, order.id, userId, session.id, payments), chargeOrder(db, order.id, userId, session.id, payments),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(await db.salePayment.count()).toBe(1);
  });

  it('permite ocho pedidos independientes simultáneos', async () => {
    const product = await createTestProduct(db);
    const input = { channel: 'counter' as const, items: [{ productId: product.id, quantity: 1 }] };
    const orders = await Promise.all(Array.from({ length: 8 }, () => createOrder(db, userId, input)));
    expect(new Set(orders.map((order) => order.id)).size).toBe(8);
  });
});
