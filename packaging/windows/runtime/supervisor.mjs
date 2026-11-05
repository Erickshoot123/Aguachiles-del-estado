import { protectBackup, unlockBackup, validateBackupPassword } from './protected-backup.mjs';
import { createInterface } from 'node:readline';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalDatabase } from './database.mjs';
import { run, startService, stopService, waitHttp } from './processes.mjs';
import { startWebServer } from './web-server.mjs';
import { registerUpdates } from './updates/controller.mjs';

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const lines = createInterface({ input: process.stdin });
const emit = (type, message) => process.stdout.write(JSON.stringify({ type, message }) + '\n');
let config, database, api, printer, web, stopping, updates;
const safeMessage = (error) => {
  let message = String(error?.message ?? error);
  for (const key of ['dbPassword', 'appPassword', 'jwtSecret', 'adminPassword']) {
    if (config?.[key]) message = message.split(config[key]).join('[oculto]');
  }
  return message;
};
async function stop() {
  if (stopping) return stopping;
  stopping = (async () => {
    await updates?.close();
    if (web) await new Promise((resolve) => web.close(resolve));
    await Promise.all([stopService(api), stopService(printer)]);
    if (database) await database.stop();
    lines.close();
  })();
  return stopping;
}
async function start() {
  const iterator = lines[Symbol.asyncIterator]();
  const first = await iterator.next();
  config = JSON.parse(first.value);
  const logs = join(config.root, 'data', 'logs');
  await mkdir(logs, { recursive: true });
  const manifest = JSON.parse(await readFile(join(appDir, 'manifest.json'), 'utf8'));
  emit('status', 'Preparando base de datos local…');
  database = new LocalDatabase(appDir, config);
  await database.start();
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    NODE_OPTIONS: '',
    POS_MODE: 'local',
    TZ: config.timeZone,
    CHECKPOINT_DISABLE: '1',
    PRISMA_HIDE_UPDATE_MESSAGE: '1',
    POS_TIME_ZONE: config.timeZone,
    HOST: '127.0.0.1',
    JWT_SECRET: config.jwtSecret,
    CORS_ORIGIN: `http://127.0.0.1:${config.webPort}`,
    DATABASE_URL: database.url(true),
  };
  delete env.SYNC_CENTRAL_URL;
  delete env.SYNC_TOKEN;
  const versionFile = join(config.root, 'data', 'schema-version');
  const previous = await readFile(versionFile, 'utf8').catch(() => null);
  if (previous !== manifest.version) {
    if (previous) {
      emit('status', 'Creando respaldo antes de actualizar…');
      await database.backup('antes-de-actualizar');
    }
    emit('status', 'Actualizando estructura de datos…');
    await run(
      process.execPath,
      [
        join(appDir, 'node_modules', 'prisma', 'build', 'index.js'),
        'migrate',
        'deploy',
        '--schema',
        join(appDir, 'prisma', 'schema.prisma'),
      ],
      { cwd: appDir, env },
    );
    await writeFile(versionFile, manifest.version);
  }
  const configured = join(config.root, 'data', 'configured');
  if (!(await readFile(configured, 'utf8').catch(() => null))) {
    emit('status', 'Creando sucursal, menú y administrador…');
    await run(process.execPath, [join(appDir, 'api', 'scripts', 'install-local.js')], {
      cwd: appDir,
      env,
      input: JSON.stringify({
        locationName: config.locationName,
        adminUsername: config.adminUsername,
        adminPassword: config.adminPassword,
      }),
    });
    await writeFile(configured, '1');
  }
  delete config.adminPassword;
  await database.grantAppAccess();
  env.DATABASE_URL = database.url();
  emit('status', 'Iniciando POS e impresora…');
  api = startService(
    join(appDir, 'api', 'src', 'server.js'),
    appDir,
    { ...env, PORT: String(config.apiPort), POS_DESKTOP_UPDATES: '1' },
    join(logs, 'api.log'),
  );
  const printers = [
    {
      id: 'default',
      name: config.printerName || 'Archivo de prueba',
      interface: config.printerName
        ? `printer:${config.printerName}`
        : join(config.root, 'data', 'print-output', 'last-ticket.bin'),
      qrMode: 'raster',
    },
  ];
  printer = startService(
    join(appDir, 'print-agent', 'server.js'),
    appDir,
    {
      ...env,
      PORT: String(config.printPort),
      PRINTERS: JSON.stringify(printers),
      PRINTER_SETTINGS_FILE: join(config.root, 'data', 'printer-settings.json'),
      PRINT_ALLOWED_ORIGINS: `http://127.0.0.1:${config.webPort}`,
      PRINTER_WIDTH_58: '32',
    },
    join(logs, 'print-agent.log'),
  );
  updates = await registerUpdates({ root: config.root, appDir, api, printer, database });
  for (const child of [api, printer])
    child.on('exit', () => {
      if (!stopping) {
        emit('error', 'Se detuvo un servicio local. Abre de nuevo el POS y revisa los registros.');
        void stop().finally(() => process.exit(1));
      }
    });
  await Promise.all([
    waitHttp(`http://127.0.0.1:${config.apiPort}/health`),
    waitHttp(`http://127.0.0.1:${config.printPort}/health`),
  ]);
  web = await startWebServer(join(appDir, 'web'), config.webPort);
  emit('ready', `http://127.0.0.1:${config.webPort}`);
  for await (const line of { [Symbol.asyncIterator]: () => iterator }) {
    if (line === 'STOP') {
      await stop();
      return;
    }
    if (line.startsWith('{')) {
      try {
        const command = JSON.parse(line);
        validateBackupPassword(command.password);
        if (command.type === 'BACKUP_PROTECTED') {
          const plain = await database.backup();
          const protectedPath = plain + '.agpos';
          await protectBackup(plain, protectedPath, command.password);
          const { unlink } = await import('node:fs/promises');
          await unlink(plain);
          emit('backup', protectedPath);
        } else if (command.type === 'UNLOCK_BACKUP') {
          await unlockBackup(command.input, command.output, command.password);
          emit('backup', command.output);
        }
      } catch (error) {
        emit('error', error.message);
      }
    }
    if (line === 'BACKUP') {
      try {
        emit('backup', await database.backup());
      } catch (error) {
        emit('error', safeMessage(error));
      }
    }
  }
  await stop();
}
process.once('SIGINT', () => {
  void stop();
});
process.once('SIGTERM', () => {
  void stop();
});
start().catch(async (error) => {
  emit('error', safeMessage(error));
  await stop().catch(() => {});
  process.exitCode = 1;
});
