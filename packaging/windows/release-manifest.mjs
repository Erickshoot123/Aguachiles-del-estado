import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileHash } from './runtime/updates/download.mjs';
import { publicKeyXml } from './runtime/updates/manifest.mjs';
import { stableVersion, UPDATER_VERSION } from './runtime/updates/version.mjs';

export async function releaseManifest({
  installer,
  version,
  releaseNotes,
  privateKeyPem,
  expectedPublicKeyPem,
}) {
  stableVersion(version);
  if (basename(installer) !== `AguachilesPOS-Instalador-${version}.exe`)
    throw new Error('El nombre del instalador no coincide con la versión.');
  if (typeof releaseNotes !== 'string' || releaseNotes.length > 12000)
    throw new Error('Las notas de versión exceden el límite permitido.');
  const privateKey = createPrivateKey(privateKeyPem);
  const publicKeyPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });
  if (publicKeyXml(publicKeyPem) !== publicKeyXml(expectedPublicKeyPem))
    throw new Error('La clave de firma no coincide con la clave pública incluida en el POS.');
  const size = (await stat(installer)).size;
  if (size < 1 || size > 1073741824) throw new Error('Tamaño de instalador inválido.');
  const bytes = Buffer.from(
    JSON.stringify(
      {
        formatVersion: 1,
        product: 'AguachilesPOS',
        version,
        platform: 'windows-x64',
        minimumUpdaterVersion: UPDATER_VERSION,
        asset: basename(installer),
        size,
        sha256: await fileHash(installer),
        releaseNotes,
      },
      null,
      2,
    ) + '\n',
  );
  return { bytes, signature: sign('RSA-SHA256', bytes, privateKey) };
}
