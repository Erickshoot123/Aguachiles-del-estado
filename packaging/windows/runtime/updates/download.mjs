import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { githubRequest } from './http.mjs';

export async function fileHash(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
export async function downloadVerified(
  url,
  destination,
  manifest,
  onProgress,
  request = githubRequest,
) {
  await mkdir(dirname(destination), { recursive: true });
  const temporary = destination + '.' + randomUUID() + '.part';
  let file;
  try {
    const response = await request(url, undefined, 1800000);
    if (!response.ok)
      throw new Error(`No se pudo descargar la actualización (${response.status}).`);
    const length = response.headers.get('content-length');
    if (length && Number(length) !== manifest.size)
      throw new Error('El tamaño del paquete no coincide.');
    file = await open(temporary, 'wx');
    const hash = createHash('sha256');
    let received = 0;
    for await (const chunk of response.body) {
      received += chunk.length;
      if (received > manifest.size)
        throw new Error('El paquete descargado excede el tamaño esperado.');
      hash.update(chunk);
      await file.writeFile(chunk);
      onProgress(Math.floor((received * 100) / manifest.size));
    }
    if (received !== manifest.size || hash.digest('hex') !== manifest.sha256)
      throw new Error('El paquete está incompleto o fue alterado. No se instalará.');
    await file.sync();
    await file.close();
    file = null;
    await rename(temporary, destination);
  } finally {
    await file?.close();
    await unlink(temporary).catch(() => {});
  }
}
