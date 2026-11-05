import { writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { stableVersion } from './runtime/updates/version.mjs';
import { releaseManifest } from './release-manifest.mjs';

const version = stableVersion(process.env.RELEASE_VERSION);
const output = resolve(process.env.RELEASE_OUTPUT);
const releaseNotes = process.env.RELEASE_NOTES || 'Mejoras de Aguachiles POS.';
const result = await releaseManifest({
  installer: join(output, `AguachilesPOS-Instalador-${version}.exe`),
  version,
  releaseNotes,
  privateKeyPem: process.env.UPDATE_SIGNING_PRIVATE_KEY,
  expectedPublicKeyPem: process.env.POS_UPDATE_PUBLIC_KEY_PEM,
});
await writeFile(join(output, 'update-manifest.json'), result.bytes, { flag: 'wx' });
await writeFile(join(output, 'update-manifest.sig'), result.signature, { flag: 'wx' });
await writeFile(join(output, 'release-notes.md'), releaseNotes, { flag: 'wx' });
console.warn(
  `Manifiesto firmado de ${version} preparado. La clave privada no se incluye en el paquete.`,
);
