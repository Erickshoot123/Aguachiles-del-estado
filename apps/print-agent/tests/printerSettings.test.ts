import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { loadEnv } from '../src/config/env.js';
import { PrinterSettings } from '../src/printers/printerSettings.js';
import { windowsPrinterId, type WindowsPrinter } from '../src/printers/windowsPrinters.js';
import { printerSettingsRoutes } from '../src/printerSettings.routes.js';
import printRoutes from '../src/print.routes.js';
import { PrintActivity } from '../src/printers/printActivity.js';

test('pausar para actualizar rechaza impresiones nuevas y no crea un archivo de salida', async (t) => {
  const { env } = await setup(t);
  const activity = new PrintActivity();
  activity.busy = 1;
  assert.equal(activity.prepare(), false);
  assert.equal(activity.paused, false);
  activity.busy = 0;
  assert.equal(activity.prepare(), true);
  const app = Fastify();
  t.after(() => app.close());
  await app.register(printRoutes, { env, activity });
  const response = await app.inject({
    method: 'POST',
    url: '/print',
    payload: {
      ticket: {
        saleId: '11111111-1111-4111-8111-111111111111',
        ticketNumber: 'NO IMPRIMIR',
        format: 'thermal_58',
        issuedAt: new Date().toISOString(),
        businessName: 'Prueba',
        lines: [{ productName: 'Prueba', quantity: 1, unitPrice: 0, subtotal: 0 }],
        subtotal: 0,
        taxTotal: 0,
        discountTotal: 0,
        total: 0,
        isReprint: false,
      },
    },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(activity.busy, 0);
  await assert.rejects(readFile(env.PRINTERS[0]!.interface));
});

const printer: WindowsPrinter = {
  id: windowsPrinterId('Ofichido "USB&BT"'),
  name: 'Ofichido "USB&BT"',
  port: 'USB002',
  driver: 'Generic / Text Only',
  offline: false,
  kind: 'windows',
};
async function setup(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'agpos-printers-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = loadEnv({
    PRINTER_SETTINGS_FILE: join(root, 'settings.json'),
    PRINTERS: JSON.stringify([
      { id: 'default', name: 'Archivo de prueba', interface: join(root, 'test.bin') },
    ]),
  });
  return { env, manager: new PrinterSettings(env, async () => [printer]) };
}
test('guarda la cola USB/Bluetooth por nombre, conserva QR y recupera el destino al reiniciar', async (t) => {
  const { env, manager } = await setup(t);
  await manager.initialize();
  await manager.save({ printerId: printer.id, qrMode: 'raster' });
  assert.equal(env.PRINTERS[0]!.interface, `printer:${printer.name}`);
  const freshEnv = loadEnv({
    PRINTER_SETTINGS_FILE: env.PRINTER_SETTINGS_FILE,
    PRINTERS: JSON.stringify([
      {
        id: 'default',
        name: 'Archivo de prueba',
        interface: env.PRINTER_SETTINGS_FILE.replace('settings.json', 'test.bin'),
      },
    ]),
  });
  const restarted = new PrinterSettings(freshEnv, async () => []);
  await restarted.initialize();
  assert.equal(freshEnv.PRINTERS[0]!.interface, `printer:${printer.name}`);
  assert.match((await restarted.status()).warning!, /no aparece/);
  assert.equal(freshEnv.PRINTERS[0]!.qrMode, 'raster');
});
test('no guarda colas inventadas y permite red por IP/puerto sin cambiar el sistema Windows', async (t) => {
  const { env, manager } = await setup(t);
  await assert.rejects(manager.save({ printerId: 'windows:inexistente', qrMode: 'off' }));
  await assert.rejects(manager.save({ printerId: 'network', qrMode: 'off' }));
  await manager.save({
    printerId: 'network',
    qrMode: 'off',
    network: { host: '192.168.1.50', port: 9100 },
  });
  assert.equal(env.PRINTERS[0]!.interface, 'tcp://192.168.1.50:9100');
});
test('solo configura desde localhost y el origen del POS; consultar y guardar no imprimen', async (t) => {
  const { env, manager } = await setup(t);
  const app = Fastify();
  t.after(() => app.close());
  await app.register(printerSettingsRoutes, { env, settings: manager });
  const payload = { printerId: printer.id, qrMode: 'raster' };
  assert.equal(
    (
      await app.inject({
        method: 'PUT',
        url: '/printer-settings',
        headers: { origin: 'https://ajeno.example' },
        payload,
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: 'PUT',
        url: '/printer-settings',
        remoteAddress: '192.168.1.20',
        payload,
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: 'PUT',
        url: '/printer-settings',
        headers: { origin: 'http://127.0.0.1:5173' },
        payload,
      })
    ).statusCode,
    200,
  );
  const result = await app.inject('/printer-settings');
  assert.equal(result.json().activeName, printer.name);
  await assert.rejects(readFile(env.PRINTER_SETTINGS_FILE.replace('settings.json', 'test.bin')));
});
test('el destino guardado se usa para imprimir a archivo sin papel ni ventas reales', async (t) => {
  const { env, manager } = await setup(t);
  await manager.save({ printerId: 'configured', qrMode: 'off' });
  const app = Fastify();
  t.after(() => app.close());
  await app.register(printRoutes, { env });
  const response = await app.inject({
    method: 'POST',
    url: '/print',
    payload: {
      printerId: 'default',
      ticket: {
        saleId: '11111111-1111-4111-8111-111111111111',
        ticketNumber: 'PRUEBA',
        format: 'thermal_58',
        issuedAt: new Date().toISOString(),
        businessName: 'Aguachiles del Estado',
        lines: [{ productName: 'PRUEBA SIN PAPEL', quantity: 1, unitPrice: 0, subtotal: 0 }],
        subtotal: 0,
        taxTotal: 0,
        discountTotal: 0,
        total: 0,
        isReprint: false,
      },
    },
  });
  assert.equal(response.statusCode, 200);
  assert.match(await readFile(env.PRINTERS[0]!.interface, 'latin1'), /PRUEBA SIN PAPEL/);
});
