import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync } from 'node:crypto';
import { run } from './runtime/processes.mjs';
import { releaseManifest } from './release-manifest.mjs';
import { publicKeyXml } from './runtime/updates/manifest.mjs';
if (process.platform !== 'win32') throw new Error('La verificación nativa requiere Windows.');
const temporary = await mkdtemp(join(tmpdir(), 'agpos-native-update-'));
const source = join(dirname(fileURLToPath(import.meta.url)), 'native');
if (!temporary.startsWith(join(tmpdir(), 'agpos-native-update-')))
  throw new Error('Carpeta temporal inesperada');
try {
  const compiler = join(process.env.WINDIR, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const refs = [
    'System.Windows.Forms.dll',
    'System.Drawing.dll',
    'System.Security.dll',
    'System.Web.Extensions.dll',
    'Microsoft.CSharp.dll',
  ].map((name) => `/reference:${name}`);
  async function compile(name, files, library = false) {
    const result = await run(
      compiler,
      [
        '/nologo',
        `/target:${library ? 'library' : 'exe'}`,
        '/codepage:65001',
        `/out:${join(temporary, name)}`,
        ...refs,
        ...files.map((file) => join(source, file)),
      ],
      { allowFailure: true },
    );
    if (result.code) throw new Error(result.output + result.error);
  }
  await compile('runner.dll', ['Common.cs', 'UpdatePackage.cs', 'UpdateRunner.cs'], true);
  await compile('probe.exe', [
    'Common.cs',
    'UpdatePackage.cs',
    'InstallActivation.cs',
    'UpdateProbe.cs',
  ]);
  const root = join(temporary, 'instalacion de prueba');
  const appDir = join(root, 'versions/0.2.6');
  await mkdir(appDir, { recursive: true });
  await mkdir(join(root, 'updates/0.2.7'), { recursive: true });
  await mkdir(join(root, 'data'));
  await writeFile(join(root, 'current-version'), '0.2.6');
  await writeFile(join(root, 'data/sentinel'), 'conservar');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 3072 });
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  await writeFile(
    join(appDir, 'update-channel.json'),
    JSON.stringify({ publicKeyXml: publicKeyXml(pem) }),
  );
  const installer = join(root, 'updates/0.2.7/AguachilesPOS-Instalador-0.2.7.exe');
  await writeFile(installer, 'SOLO DATOS; NUNCA EJECUTAR');
  const signed = await releaseManifest({
    installer,
    version: '0.2.7',
    releaseNotes: 'Prueba',
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    expectedPublicKeyPem: pem,
  });
  await writeFile(
    join(root, 'updates/install-plan.json'),
    JSON.stringify({
      manifest: signed.bytes.toString('base64'),
      signature: signed.signature.toString('base64'),
    }),
  );
  await run(join(temporary, 'probe.exe'), ['verify', root, appDir]);
  await writeFile(installer, 'ALTERADO');
  await run(join(temporary, 'probe.exe'), ['reject', root, appDir]);
  const destination = join(temporary, 'nueva-version');
  await mkdir(destination);
  for (const name of [
    'Microsoft.Web.WebView2.Core.dll',
    'Microsoft.Web.WebView2.WinForms.dll',
    'WebView2Loader.dll',
    'AguachilesPOS.exe',
  ]) {
    await writeFile(join(destination, name), 'nuevo');
    await writeFile(join(root, name), 'anterior');
  }
  console.warn(
    (await run(join(temporary, 'probe.exe'), ['activation', root, destination])).output.trim(),
  );
  console.warn(
    'Firma RSA/SHA-256 interoperable Node/.NET y rechazo de paquete alterado: correctos. No se ejecutó ningún instalador.',
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
