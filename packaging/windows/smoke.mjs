import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { run } from './runtime/processes.mjs';
import { chromium } from '@playwright/test';
import { LocalDatabase } from './runtime/database.mjs';

const getArg = (name) => process.argv[process.argv.indexOf(name) + 1];
const installer = resolve(getArg('--installer'));
const buildRoot = resolve(getArg('--build-root'));
const testBase = process.argv.includes('--test-root') ? resolve(getArg('--test-root')) : buildRoot;
const root = join(testBase, `prueba con espacios-${Date.now()}`);
const packaging = dirname(fileURLToPath(import.meta.url));
const report = { installer, root, checks: [], success: false };
const config = { root, locationName: 'Sucursal de prueba de instalación', adminUsername: 'admin_prueba',
  adminPassword: 'Prueba-' + randomUUID(), dbPassword: randomBytes(32).toString('hex'),
  appPassword: randomBytes(32).toString('hex'), jwtSecret: randomBytes(32).toString('hex'),
  timeZone: 'America/Mazatlan', printerName: '', dbPort: 54329, webPort: 48880, apiPort: 48881, printPort: 48882 };
const check = (name) => { report.checks.push(name); console.warn(name); };
let session;
async function boot(appDir) {
  const isolatedEnv = { ...process.env };
  for (const key of Object.keys(isolatedEnv)) if (/^(path|node_path|node_options)$/i.test(key)) delete isolatedEnv[key];
  isolatedEnv.Path = [process.env.WINDIR, join(process.env.WINDIR, 'System32'), join(process.env.WINDIR, 'System32/WindowsPowerShell/v1.0')].join(';');
  isolatedEnv.HTTPS_PROXY = 'http://127.0.0.1:1';
  isolatedEnv.HTTP_PROXY = 'http://127.0.0.1:1';
  isolatedEnv.NO_PROXY = '127.0.0.1,localhost';
  const child = spawn(join(appDir, 'node/node.exe'), [join(appDir, 'desktop/supervisor.mjs')], {
    cwd: appDir, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: isolatedEnv,
  });
  const events = [];
  let stopped = false;
  const exited = new Promise((ready) => child.once('exit', (code) => { stopped = true; ready(code); }));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  createInterface({ input: child.stdout }).on('line', (line) => {
    try { const item = JSON.parse(line); events.push(item); if (item.type === 'status') console.warn(item.message); } catch { /* Solo protocolo JSON. */ }
  });
  child.stdin.write(JSON.stringify(config) + '\n');
  const event = async (type) => {
    const until = Date.now() + 180000;
    while (Date.now() < until) {
      const error = events.find((item) => item.type === 'error');
      if (error) throw new Error(error.message);
      const index = events.findIndex((item) => item.type === type);
      if (index >= 0) return events.splice(index, 1)[0];
      if (stopped) throw new Error('El supervisor se detuvo antes de completar la prueba.');
      await new Promise((ready) => setTimeout(ready, 200));
    }
    throw new Error(`Tiempo agotado esperando ${type}`);
  };
  return { child, event, exited };
}
async function stop() {
  if (!session) return;
  session.child.stdin.write('STOP\n');
  const timer = setTimeout(() => { session?.child.kill(); }, 45000);
  const code = await session.exited;
  clearTimeout(timer); session = null;
  assert.equal(code, 0, 'El supervisor debe cerrar sin error.');
}
async function request(path, method = 'GET', body, token) {
  const response = await fetch(`http://127.0.0.1:48881${path}`, { method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  assert.ok(response.ok, `La API respondió ${response.status} en ${path}`);
  return response.status === 204 ? null : response.json();
}
try {
  assert.ok(root.startsWith(testBase + '\\'), 'La prueba debe quedar dentro de la carpeta de prueba elegida.');
  await run(installer, ['/silent', `/dir=${root}`]);
  check('Extracción e integridad del instalador EXE');
  const version = (await readFile(join(root, 'current-version'), 'utf8')).trim();
  const appDir = join(root, 'versions', version);
  // Se prueba el mismo almacenamiento DPAPI que usa el lanzador nativo.
  const probe = join(buildRoot, 'config-probe.exe');
  await run(join(process.env.WINDIR, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'), ['/nologo', '/target:exe', '/platform:x64',
    `/out:${probe}`, '/reference:System.Security.dll', '/reference:System.Web.Extensions.dll', '/reference:Microsoft.CSharp.dll',
    join(packaging, 'native/Common.cs'), join(packaging, 'native/ConfigProbe.cs')]);
  await run(probe, [], { input: JSON.stringify(config) });
  check('Configuración cifrada con DPAPI, sin guardar contraseña de administrador');
  session = await boot(appDir);
  await session.event('ready');
  check('PostgreSQL, migraciones, API, agente e interfaz empaquetados');
  const html = await fetch('http://127.0.0.1:48880/login');
  assert.equal(html.status, 200);
  assert.ok((await html.text()).includes('id="root"'));
  const auth = await request('/api/auth/login', 'POST', { username: config.adminUsername, password: config.adminPassword });
  const token = auth.accessToken;
  const users = await request('/api/auth/users', 'GET', undefined, token);
  assert.equal(users.length, 1);
  const identity = await new LocalDatabase(appDir, config).sql('SELECT id FROM locations WHERE is_active;', 'aguachiles_pos');
  assert.ok(identity && identity !== '00000000-0000-0000-0000-000000000001', 'Cada instalación nueva necesita identidad propia de sucursal.');
  const plates = await request('/api/plates/today', 'GET', undefined, token);
  assert.equal(plates.initialized, false);
  check('Administrador elegido y captura de platos obligatoria; sin usuarios demo');
  await request('/api/plates/today', 'POST', { kilo: 1, halfKilo: 2 }, token);
  const products = await request('/api/products', 'GET', undefined, token);
  const product = products.find((item) => item.name === 'Aguachile Tradicional (medio kilo)');
  const input = { clientRequestId: randomUUID(), channel: 'counter', items: [{ productId: product.id, quantity: 1 }] };
  const order = await request('/api/orders', 'POST', input, token);
  const repeated = await request('/api/orders', 'POST', input, token);
  assert.equal(repeated.id, order.id);
  const { ticket } = await request(`/api/orders/${order.id}/comanda`, 'GET', undefined, token);
  const printed = await fetch('http://127.0.0.1:48882/print', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket, printerId: 'default' }) });
  assert.ok(printed.ok);
  const bytes = await readFile(join(root, 'data/print-output/last-ticket.bin'), 'latin1');
  assert.ok(bytes.includes('COMANDA DE COCINA') && !bytes.includes('TOTAL'));
  check('Pedido idempotente, reserva de platos y comanda de 58 mm a archivo');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', (route) => {
      const host = new URL(route.request().url()).hostname;
      return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.abort();
    });
    await page.goto('http://127.0.0.1:48880/login');
    await page.getByLabel('Usuario').fill(config.adminUsername);
    await page.getByLabel('Contraseña').fill(config.adminPassword);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await page.getByRole('heading', { name: 'Tablero de pedidos' }).waitFor();
    await page.getByRole('button', { name: 'Nuevo pedido' }).click();
    const dialog = page.getByRole('dialog').last();
    await dialog.getByRole('button', { name: 'Mostrador', exact: true }).click();
    await dialog.getByRole('button', { name: 'Agregar uno: Aguachile Tradicional (medio kilo)', exact: true }).click();
    await dialog.getByRole('button', { name: 'Crear pedido', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const afterUi = await request('/api/plates/today', 'GET', undefined, token);
    assert.equal(afterUi.buckets.find((bucket) => bucket.size === 'half_kilo').available, 0);
    await page.screenshot({ path: join(buildRoot, 'packaged-pos.png'), fullPage: true });
    check('Interfaz compilada: login, pedido y comanda automática sin peticiones externas');
  } finally { await browser.close(); }
  session.child.stdin.write('BACKUP\n');
  const backup = await session.event('backup');
  assert.ok((await stat(backup.message)).size > 0);
  check('Respaldo PostgreSQL completo');
  await stop();
  check('Cierre ordenado de servicios y PostgreSQL');
  const before = await readFile(join(root, 'data/config.dat'));
  await run(installer, ['/silent', `/dir=${root}`]);
  assert.deepEqual(await readFile(join(root, 'data/config.dat')), before);
  await writeFile(join(root, 'data/schema-version'), 'version-anterior-simulada');
  session = await boot(appDir);
  await session.event('ready');
  const authAgain = await request('/api/auth/login', 'POST', { username: config.adminUsername, password: config.adminPassword });
  const found = await request(`/api/orders/lookup?ticketNumber=${encodeURIComponent(order.ticketNumber)}`, 'GET', undefined, authAgain.accessToken);
  assert.equal(found.id, order.id);
  assert.ok((await readdir(join(root, 'data/backups'))).some((name) => name.includes('antes-de-actualizar')));
  check('Reinstalación conserva configuración y pedidos; respaldo previo a migrar');
  await stop();
  await run(join(root, 'Uninstall.exe'), ['/silent']);
  const untilRemoved = Date.now() + 60000;
  while (await stat(join(root, 'versions')).catch(() => null)) {
    if (Date.now() > untilRemoved) throw new Error('La desinstalación no terminó.');
    await new Promise((ready) => setTimeout(ready, 300));
  }
  assert.ok(await stat(join(root, 'data/postgres/PG_VERSION')));
  assert.deepEqual(await readFile(join(root, 'data/config.dat')), before);
  check('Desinstalación elimina el programa y conserva datos y configuración');
  report.success = true;
} finally {
  if (session) await stop().catch(() => {});
  await mkdir(buildRoot, { recursive: true });
  await writeFile(join(buildRoot, 'smoke-report.json'), JSON.stringify(report, null, 2));
}
