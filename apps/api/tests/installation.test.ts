import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { disconnectTestDb, resetDatabase, testPrisma as db } from './testDb.js';
import { bootstrapLocalInstallation } from '../src/modules/installation/bootstrap.service.js';

const input = { locationName: 'Sucursal nueva', adminUsername: 'encargado', adminPassword: 'Instalacion-segura-123' };
describe('primera instalación local', () => {
  beforeEach(resetDatabase);
  afterAll(disconnectTestDb);
  it('crea solo el administrador elegido, menú y caja; no crea ventas, usuarios demo ni platos disponibles', async () => {
    await bootstrapLocalInstallation(db, input);
    const users = await db.user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0]?.username).toBe('encargado');
    expect(await bcrypt.compare(input.adminPassword, users[0]!.passwordHash)).toBe(true);
    expect(await db.sale.count()).toBe(0);
    expect(await db.plateDay.count()).toBe(0);
    expect(await db.product.count()).toBe(12);
    expect(await db.product.count({ where: { plateSize: { not: null } } })).toBe(6);
    expect(await db.inventory.count({ where: { quantity: { not: 0 } } })).toBe(0);
    expect(await db.cashRegister.count()).toBe(1);
  });
  it('reintentar o actualizar no borra usuarios, cambia precios ni renombra la sucursal', async () => {
    await bootstrapLocalInstallation(db, input);
    await db.product.update({ where: { sku: 'AGU-TRAD-MK' }, data: { price: 180 } });
    await bootstrapLocalInstallation(db, { ...input, locationName: 'Otra' });
    expect(await db.user.count()).toBe(1);
    expect((await db.product.findUniqueOrThrow({ where: { sku: 'AGU-TRAD-MK' } })).price.toNumber()).toBe(180);
    expect((await db.location.findFirstOrThrow()).name).toBe('Sucursal nueva');
    await expect(bootstrapLocalInstallation(db, { ...input, adminPassword: 'Otra-clave-distinta-123' })).rejects.toThrow('existente');
    expect(await bcrypt.compare(input.adminPassword, (await db.user.findFirstOrThrow()).passwordHash)).toBe(true);
  });
  it('inicializaciones simultáneas no duplican cuentas o menú', async () => {
    await Promise.all([bootstrapLocalInstallation(db, input), bootstrapLocalInstallation(db, input)]);
    expect(await db.user.count()).toBe(1);
    expect(await db.product.count()).toBe(12);
  });
  it('reutiliza la sucursal inicial creada por las migraciones de una base nueva', async () => {
    const migrationId = '00000000-0000-0000-0000-000000000001';
    await db.location.create({ data: { id: migrationId, name: 'Sucursal principal' } });
    await bootstrapLocalInstallation(db, input);
    expect(await db.location.count()).toBe(1);
    const installed = await db.location.findFirstOrThrow();
    expect(installed.id).not.toBe(migrationId);
    expect(installed.name).toBe(input.locationName);
    expect((await db.cashRegister.findFirstOrThrow()).locationId).toBe(installed.id);
  });
});
