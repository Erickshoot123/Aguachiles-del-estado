import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicKeyXml } from './runtime/updates/manifest.mjs';

const argument = process.argv.indexOf('--output');
if (argument < 0 || !process.argv[argument + 1])
  throw new Error('Indica --output y una carpeta privada fuera del repositorio.');
const folder = resolve(process.argv[argument + 1]);
const repository = resolve(fileURLToPath(new URL('../../', import.meta.url)));
if (
  folder === repository ||
  folder.startsWith(repository + '/') ||
  folder.startsWith(repository + '\\')
)
  throw new Error('Guarda las claves fuera del repositorio.');
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 3072,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
await mkdir(folder, { recursive: true });
await writeFile(join(folder, 'update-private.pem'), privateKey, { mode: 0o600, flag: 'wx' });
await writeFile(join(folder, 'update-public.pem'), publicKey, { flag: 'wx' });
await writeFile(join(folder, 'update-public.xml'), publicKeyXml(publicKey), { flag: 'wx' });
console.warn(
  `Claves creadas en ${folder}. Guarda update-private.pem como secreto de GitHub; nunca lo subas al repositorio ni al POS.`,
);
