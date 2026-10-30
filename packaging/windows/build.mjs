import { mkdir, readFile, writeFile, cp, readdir, lstat, unlink, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const packaging = join(root, 'packaging', 'windows');
const buildArg = process.argv.indexOf('--build-root');
const buildRoot = buildArg < 0 ? join(root, 'build', 'windows') : resolve(process.argv[buildArg + 1]);
const cache = join(buildRoot, 'cache');
const stageArg = process.argv.indexOf('--stage');
const stage = stageArg < 0 ? join(buildRoot, `stage-${Date.now()}`) : resolve(process.argv[stageArg + 1]);
if (!stage.startsWith(buildRoot + '\\') || !relative(buildRoot, stage).startsWith('stage-')) throw new Error('La carpeta de staging debe estar dentro de build-root.');
const outputArg = process.argv.indexOf('--output');
const output = outputArg < 0 ? join(buildRoot, 'releases') : resolve(process.argv[outputArg + 1]);
const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
async function command(file, args, options = {}) {
  await new Promise((ready, reject) => {
    const child = spawn(file, args, { cwd: root, windowsHide: true, stdio: 'inherit', ...options });
    child.once('error', reject); child.once('exit', (code) => code === 0 ? ready() : reject(new Error(`${file} terminó con ${code}`)));
  });
}
async function hash(file) {
  const value = createHash('sha256');
  for await (const chunk of createReadStream(file)) value.update(chunk);
  return value.digest('hex');
}
async function download(vendor) {
  const path = join(cache, vendor.file);
  if (!await stat(path).catch(() => null)) {
    const response = await fetch(vendor.url, { signal: AbortSignal.timeout(600000) });
    if (!response.ok) throw new Error(`Falló la descarga oficial de ${vendor.file}`);
    await pipeline(response.body, createWriteStream(path));
  }
  if (await hash(path) !== vendor.sha256) throw new Error(`SHA-256 incorrecto: ${vendor.file}. No se ejecutó el archivo.`);
  return path;
}
async function filesBelow(folder) {
  const result = [];
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, item.name);
    if (item.isDirectory()) result.push(...await filesBelow(path));
    else if (item.isFile()) result.push(path);
    else throw new Error(`El paquete no admite enlaces: ${path}`);
  }
  return result;
}
async function compile(name, sources, resources = []) {
  const compiler = join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
  await command(compiler, ['/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/codepage:65001',
    `/out:${name}`, `/win32manifest:${join(packaging, 'native', 'app.manifest')}`,
    ...['System.Windows.Forms.dll', 'System.Drawing.dll', 'System.Security.dll', 'System.Web.Extensions.dll', 'Microsoft.CSharp.dll', 'System.IO.Compression.dll', 'System.IO.Compression.FileSystem.dll'].map((item) => `/reference:${item}`),
    ...resources, ...sources.map((item) => join(packaging, 'native', item))]);
}

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Construye este instalador en Windows x64.');
await Promise.all([mkdir(cache, { recursive: true }), mkdir(stage, { recursive: true }), mkdir(output, { recursive: true })]);
const vendors = JSON.parse(await readFile(join(packaging, 'vendor-lock.json'), 'utf8'));
console.warn('Verificando runtimes oficiales…');
const [nodeZip, postgresZip] = await Promise.all([download(vendors.node), download(vendors.postgres)]);
const env = { ...process.env, VITE_API_URL: 'http://127.0.0.1:48881', VITE_PRINT_AGENT_URL: 'http://127.0.0.1:48882', VITE_POS_MODE: 'local' };
if (stageArg < 0 && !process.argv.includes('--skip-build')) await command(process.execPath, [npmCli, 'run', 'build'], { env });
if (stageArg < 0) {
for (const folder of ['', 'apps/api', 'apps/web', 'apps/e2e', 'apps/print-agent', 'packages/shared', 'packages/config']) {
  await mkdir(join(stage, folder), { recursive: true });
  await cp(join(root, folder, 'package.json'), join(stage, folder, 'package.json'));
}
await cp(join(root, 'package-lock.json'), join(stage, 'package-lock.json'));
console.warn('Instalando dependencias de producción desde package-lock…');
await command(process.execPath, [npmCli, 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: stage });
// Se sustituyen solo enlaces de workspace dentro de esta carpeta de staging, nunca datos de usuario.
const links = join(stage, 'node_modules', '@aguachiles');
for (const item of await readdir(links)) {
  const path = join(links, item);
  if ((await lstat(path)).isSymbolicLink()) await unlink(path);
}
await cp(join(root, 'packages/shared/dist'), join(links, 'shared', 'dist'), { recursive: true });
await cp(join(root, 'packages/shared/package.json'), join(links, 'shared', 'package.json'));
await cp(join(root, 'node_modules', '@prisma'), join(stage, 'node_modules', '@prisma'), { recursive: true });
await cp(join(root, 'node_modules', '.prisma'), join(stage, 'node_modules', '.prisma'), { recursive: true });
await cp(join(root, 'node_modules', 'prisma'), join(stage, 'node_modules', 'prisma'), { recursive: true });
await cp(join(root, 'apps/api/dist/scripts'), join(stage, 'api/scripts'), { recursive: true });
await mkdir(join(stage, 'api/prisma'), { recursive: true });
await cp(join(root, 'apps/api/dist/prisma/menu.js'), join(stage, 'api/prisma/menu.js'));
await cp(join(root, 'apps/api/prisma'), join(stage, 'prisma'), { recursive: true, filter: (path) => !path.endsWith('.ts') });
await cp(join(root, 'apps/print-agent/dist'), join(stage, 'print-agent'), { recursive: true });
await cp(join(root, 'apps/web/dist'), join(stage, 'web'), { recursive: true });
await cp(join(packaging, 'runtime'), join(stage, 'desktop'), { recursive: true });
await command('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(packaging, 'Extract-Vendor.ps1'), '-Archive', nodeZip, '-Destination', join(stage, 'node')]);
await command('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(packaging, 'Extract-Vendor.ps1'), '-Archive', postgresZip, '-Destination', join(stage, 'postgres'), '-Postgres']);
}
await cp(join(root, 'apps/web/dist'), join(stage, 'web'), { recursive: true });
await cp(join(root, 'packages/shared/dist'), join(stage, 'node_modules/@aguachiles/shared/dist'), { recursive: true });
await cp(join(root, 'apps/print-agent/dist'), join(stage, 'print-agent'), { recursive: true });
// Al reanudar una construcción se actualizan los módulos del lanzador, sin tocar la base local.
await cp(join(root, 'apps/api/dist/src'), join(stage, 'api/src'), { recursive: true, filter: (path) => !/\.test\.js(?:\.map)?$/.test(path) });
await cp(join(packaging, 'runtime'), join(stage, 'desktop'), { recursive: true });
await cp(join(root, 'docs'), join(stage, 'docs'), { recursive: true });
if (vendors.vcRedist) {
  const redist = await download(vendors.vcRedist);
  await mkdir(join(stage, 'prerequisites'), { recursive: true });
  await cp(redist, join(stage, 'prerequisites', 'vc_redist.x64.exe'));
}
for (const file of await filesBelow(join(stage, 'api'))) {
  if (/\.test\.js(?:\.map)?$/.test(file) || /[\\/]prisma[\\/]seed\.js(?:\.map)?$/.test(file)) await unlink(file);
}
await compile(join(stage, 'AguachilesPOS.exe'), ['Common.cs', 'SetupForm.cs', 'Launcher.cs']);
await compile(join(stage, 'Uninstall.exe'), ['Common.cs', 'Uninstall.cs']);
const version = '0.2.1-preview-' + new Date().toISOString().replace(/[-:.TZ]/g, '');
const manifest = { product: 'AguachilesPOS', version, builtAt: new Date().toISOString(), vendors, files: {} };
for (const file of await filesBelow(stage)) {
  const name = relative(stage, file).replaceAll('\\', '/');
  if (name === 'manifest.json') continue;
  if (/(^|\/)\.env($|\.)|config\.dat$|\.log$/.test(name)) throw new Error(`Archivo local no permitido en el instalador: ${name}`);
  manifest.files[name] = await hash(file);
}
await writeFile(join(stage, 'manifest.json'), JSON.stringify(manifest));
await writeFile(join(buildRoot, 'latest-stage.txt'), stage);
const zip = join(buildRoot, `payload-${version}.zip`);
console.warn('Comprimiendo paquete…');
await command('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
  join(packaging, 'Zip-Payload.ps1'), '-Source', stage, '-Output', zip]);
const executable = join(output, 'AguachilesPOS-Instalador-0.2.1.exe');
await compile(executable, ['Common.cs', 'Installer.cs'], [`/resource:${zip},payload`]);
await writeFile(executable + '.sha256.txt', `${await hash(executable)}  AguachilesPOS-Instalador-0.2.1.exe\n`);
console.warn(JSON.stringify({ executable, bytes: (await stat(executable)).size, stage, version }));
