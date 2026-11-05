import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { protectBackup, unlockBackup } from './runtime/protected-backup.mjs';
test('contraseña de seis caracteres, recuperación y rechazo de clave incorrecta o archivo alterado', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agpos-crypto-'));
  try {
    const original = join(root, 'source.dump'),
      encrypted = join(root, 'backup.agpos');
    await writeFile(original, 'respaldo de prueba');
    await assert.rejects(protectBackup(original, encrypted, '12345'));
    await protectBackup(original, encrypted, '123456');
    await assert.rejects(unlockBackup(encrypted, join(root, 'wrong.dump'), 'abcdef'));
    await unlockBackup(encrypted, join(root, 'restored.dump'), '123456');
    assert.equal(await readFile(join(root, 'restored.dump'), 'utf8'), 'respaldo de prueba');
    const damaged = await readFile(encrypted);
    damaged[damaged.length - 1] ^= 1;
    await writeFile(join(root, 'damaged.agpos'), damaged);
    await assert.rejects(
      unlockBackup(join(root, 'damaged.agpos'), join(root, 'tampered.dump'), '123456'),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
