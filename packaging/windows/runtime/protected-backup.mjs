import { randomBytes, scrypt as derive, createCipheriv, createDecipheriv } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
const scrypt = promisify(derive);
const magic = Buffer.from('AGPOSBK1');
export function validateBackupPassword(password) {
  if (typeof password !== 'string' || password.length < 6)
    throw new Error('La contraseña necesita al menos 6 caracteres.');
}
export async function protectBackup(input, output, password) {
  validateBackupPassword(password);
  const salt = randomBytes(16),
    iv = randomBytes(12);
  const key = await scrypt(password, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(magic);
  const encrypted = Buffer.concat([cipher.update(await readFile(input)), cipher.final()]);
  await writeFile(output, Buffer.concat([magic, salt, iv, cipher.getAuthTag(), encrypted]), {
    flag: 'wx',
    mode: 0o600,
  });
}
export async function unlockBackup(input, output, password) {
  validateBackupPassword(password);
  const data = await readFile(input);
  if (data.length < 52 || !data.subarray(0, 8).equals(magic))
    throw new Error('No es un respaldo protegido de Aguachiles POS.');
  let plain;
  try {
    const key = await scrypt(password, data.subarray(8, 24), 32);
    const cipher = createDecipheriv('aes-256-gcm', key, data.subarray(24, 36));
    cipher.setAAD(magic);
    cipher.setAuthTag(data.subarray(36, 52));
    plain = Buffer.concat([cipher.update(data.subarray(52)), cipher.final()]);
  } catch {
    throw new Error('Contraseña incorrecta o respaldo dañado.');
  }
  await writeFile(output, plain, { flag: 'wx', mode: 0o600 });
}
