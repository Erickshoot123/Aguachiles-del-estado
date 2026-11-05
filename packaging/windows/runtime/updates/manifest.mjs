import { createPublicKey, verify } from 'node:crypto';
import { stableVersion, compareVersions, UPDATER_VERSION } from './version.mjs';

export function publicKeyXml(pem) {
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 3072)
    throw new Error('Se requiere una clave pública RSA de al menos 3072 bits.');
  const jwk = key.export({ format: 'jwk' });
  return `<RSAKeyValue><Modulus>${Buffer.from(jwk.n, 'base64url').toString('base64')}</Modulus><Exponent>${Buffer.from(jwk.e, 'base64url').toString('base64')}</Exponent></RSAKeyValue>`;
}
export function validateChannel(channel) {
  if (!channel?.repository || !channel?.publicKeyPem) return null;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(channel.repository))
    throw new Error('Repositorio de actualizaciones inválido.');
  const xml = publicKeyXml(channel.publicKeyPem);
  if (channel.publicKeyXml !== xml) throw new Error('La clave de actualizaciones no coincide.');
  return channel;
}
export function verifyManifest(bytes, signature, channel) {
  if (
    bytes.length > 65536 ||
    signature.length > 2048 ||
    !verify('RSA-SHA256', bytes, channel.publicKeyPem, signature)
  )
    throw new Error('La firma de la actualización no es válida. No se descargará ni ejecutará.');
  const manifest = JSON.parse(bytes.toString('utf8'));
  stableVersion(manifest.version);
  stableVersion(manifest.minimumUpdaterVersion);
  if (
    manifest.formatVersion !== 1 ||
    manifest.product !== 'AguachilesPOS' ||
    manifest.platform !== 'windows-x64' ||
    manifest.asset !== `AguachilesPOS-Instalador-${manifest.version}.exe` ||
    !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
    !Number.isSafeInteger(manifest.size) ||
    manifest.size < 1 ||
    manifest.size > 1073741824 ||
    typeof manifest.releaseNotes !== 'string' ||
    manifest.releaseNotes.length > 12000
  )
    throw new Error('El manifiesto de actualización es inválido.');
  if (compareVersions(manifest.minimumUpdaterVersion, UPDATER_VERSION) > 0)
    throw new Error(
      'Esta versión requiere un actualizador más reciente. Usa el instalador manual.',
    );
  return manifest;
}
export function assetUrl(channel, version, name) {
  return `https://github.com/${channel.repository}/releases/download/v${stableVersion(version)}/${encodeURIComponent(name)}`;
}
