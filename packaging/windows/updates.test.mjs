import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { releaseManifest } from './release-manifest.mjs';
import { publicKeyXml, verifyManifest } from './runtime/updates/manifest.mjs';
import { compareVersions, newerThanInstalled, stableVersion } from './runtime/updates/version.mjs';
import { UpdateManager } from './runtime/updates/manager.mjs';
import { githubRequest } from './runtime/updates/http.mjs';
import { downloadVerified } from './runtime/updates/download.mjs';

const { Response } = globalThis;
const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
const publicKeyPem = pair.publicKey.export({ type: 'spki', format: 'pem' });
const privateKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'agpos-update-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const appDir = join(root, 'versions', '0.2.6');
  await mkdir(appDir, { recursive: true });
  const channel = {
    repository: 'example/pos-releases',
    publicKeyPem,
    publicKeyXml: publicKeyXml(publicKeyPem),
  };
  await writeFile(join(appDir, 'update-channel.json'), JSON.stringify(channel));
  const installer = join(root, 'AguachilesPOS-Instalador-0.2.7.exe');
  await writeFile(installer, 'PAQUETE SINTETICO: NO ES UN EJECUTABLE');
  const signed = await releaseManifest({
    installer,
    version: '0.2.7',
    releaseNotes: 'Mejoras de impresión',
    privateKeyPem,
    expectedPublicKeyPem: publicKeyPem,
  });
  const payload = await readFile(installer);
  let checks = 0;
  let installs = 0;
  const request = async (url) => {
    checks++;
    if (String(url).endsWith('/latest'))
      return new Response(JSON.stringify({ tag_name: 'v0.2.7', draft: false, prerelease: false }));
    if (String(url).endsWith('update-manifest.json')) return new Response(signed.bytes);
    if (String(url).endsWith('update-manifest.sig')) return new Response(signed.signature);
    return new Response(payload, { headers: { 'Content-Length': String(payload.length) } });
  };
  const manager = new UpdateManager({
    root,
    appDir,
    installedVersion: '0.2.6',
    request,
    prepareInstall: async () => {
      installs++;
    },
  });
  await manager.initialize();
  return {
    root,
    appDir,
    channel,
    signed,
    manager,
    payload,
    request,
    checks: () => checks,
    installs: () => installs,
  };
}
test('compara versiones numéricamente, admite promoción de preview y rechaza rutas y downgrades', () => {
  assert.equal(compareVersions('0.2.10', '0.2.9'), 1);
  assert.ok(newerThanInstalled('0.2.6', '0.2.6-preview-20261104'));
  assert.equal(newerThanInstalled('0.2.5', '0.2.6'), false);
  for (const invalid of ['../0.2.7', 'v0.2.7', '0.2.7-beta', '01.2.7'])
    assert.throws(() => stableVersion(invalid));
});
test('no consulta GitHub al iniciar ni descarga/instala al buscar; cada paso requiere una acción', async (t) => {
  const f = await fixture(t);
  assert.equal(f.checks(), 0);
  assert.equal(f.manager.action('check').phase, 'checking');
  assert.throws(() => f.manager.action('check'));
  await f.manager.pending;
  assert.equal(f.manager.status().phase, 'available');
  assert.equal(f.checks(), 3);
  assert.equal(f.installs(), 0);
  f.manager.action('download');
  await f.manager.pending;
  assert.equal(f.manager.status().phase, 'ready');
  assert.equal(f.installs(), 0);
  f.manager.action('install');
  await f.manager.pending;
  assert.equal(f.installs(), 1);
  const plan = JSON.parse(await readFile(join(f.root, 'updates/install-plan.json'), 'utf8'));
  assert.deepEqual(Buffer.from(plan.manifest, 'base64'), f.signed.bytes);
});
test('una firma alterada o un manifiesto firmado con plataforma ajena no se acepta', async (t) => {
  const f = await fixture(t);
  const damaged = Buffer.from(f.signed.signature);
  damaged[0] ^= 1;
  assert.throws(() => verifyManifest(f.signed.bytes, damaged, f.channel), /firma/);
  const data = JSON.parse(f.signed.bytes);
  data.platform = 'linux';
  const bytes = Buffer.from(JSON.stringify(data));
  assert.throws(
    () => verifyManifest(bytes, sign('RSA-SHA256', bytes, pair.privateKey), f.channel),
    /inválido/,
  );
});
test('si el paquete cambia después de descargar, no ejecuta el instalador ni modifica el programa', async (t) => {
  const f = await fixture(t);
  f.manager.action('check');
  await f.manager.pending;
  f.manager.action('download');
  await f.manager.pending;
  await writeFile(f.manager.destination(), 'PAQUETE ALTERADO');
  f.manager.action('install');
  await f.manager.pending;
  assert.equal(f.manager.status().phase, 'error');
  assert.equal(f.installs(), 0);
  assert.equal((await readdir(f.appDir)).join(','), 'update-channel.json');
});
test('una descarga incompleta elimina solo su temporal y permite reintento explícito', async (t) => {
  const f = await fixture(t);
  const manifest = JSON.parse(f.signed.bytes);
  const destination = join(f.root, 'cache', manifest.asset);
  await assert.rejects(
    downloadVerified(
      'https://github.com/example',
      destination,
      manifest,
      () => {},
      async () => new Response('corto'),
    ),
    /incompleto/,
  );
  assert.deepEqual(await readdir(join(f.root, 'cache')), []);
  await downloadVerified(
    'https://github.com/example',
    destination,
    manifest,
    () => {},
    async () => new Response(f.payload),
  );
  assert.deepEqual(await readFile(destination), f.payload);
});
test('rechaza redirecciones hacia otros dominios o HTTP sin consultarlos', async () => {
  let calls = 0;
  await assert.rejects(
    githubRequest('https://github.com/example', async () => {
      calls++;
      return new Response(null, {
        status: 302,
        headers: { location: 'http://untrusted.example/file.exe' },
      });
    }),
    /no autorizado/,
  );
  assert.equal(calls, 1);
});
test('un canal sin clave no realiza solicitudes externas y no permite instalar', async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.appDir, 'update-channel.json'), '{}');
  const manager = new UpdateManager({
    root: f.root,
    appDir: f.appDir,
    installedVersion: '0.2.6',
    request: () => {
      throw new Error('No debe conectarse');
    },
  });
  await manager.initialize();
  assert.equal(manager.status().phase, 'unconfigured');
  assert.throws(() => manager.action('check'));
});

test('una configuración dañada desactiva solo las actualizaciones y permite arrancar el POS', async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.appDir, 'update-channel.json'), '{invalid');
  const manager = new UpdateManager({ root: f.root, appDir: f.appDir, installedVersion: '0.2.6' });
  await manager.initialize();
  assert.equal(manager.status().phase, 'unconfigured');
  assert.match(manager.status().message, /puede seguir operando/);
  assert.throws(() => manager.action('download'));
});

test('recupera la descarga después de reiniciar sin Internet y sin instalar automáticamente', async (t) => {
  const f = await fixture(t);
  f.manager.action('check');
  await f.manager.pending;
  f.manager.action('download');
  await f.manager.pending;
  let installs = 0;
  const restarted = new UpdateManager({
    root: f.root,
    appDir: f.appDir,
    installedVersion: '0.2.6',
    request: () => {
      throw new Error('No debe consultar la red');
    },
    prepareInstall: async () => {
      installs++;
    },
  });
  await restarted.initialize();
  assert.equal(restarted.status().phase, 'ready');
  assert.equal(installs, 0);
  restarted.action('install');
  await restarted.pending;
  assert.equal(installs, 1);
});

test('cerrar el POS cancela una descarga en curso sin instalar ni dejar archivos parciales', async (t) => {
  const f = await fixture(t);
  let started;
  const downloading = new Promise((resolve) => {
    started = resolve;
  });
  const manager = new UpdateManager({
    root: f.root,
    appDir: f.appDir,
    installedVersion: '0.2.6',
    prepareInstall: async () => {
      throw new Error('No debe instalar');
    },
    request: (url, _fetcher, _timeout, signal) => {
      if (!String(url).endsWith('.exe')) return f.request(url);
      started();
      return new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('Descarga cancelada')), {
          once: true,
        }),
      );
    },
  });
  await manager.initialize();
  manager.action('check');
  await manager.pending;
  manager.action('download');
  await downloading;
  await manager.close();
  assert.equal(manager.status().phase, 'error');
  assert.deepEqual(await readdir(join(f.root, 'updates/0.2.7')), []);
});
