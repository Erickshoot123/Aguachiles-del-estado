const allowedHosts = new Set([
  'api.github.com',
  'github.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
]);
export async function githubRequest(url, fetcher = fetch, timeoutMs = 30000, signal) {
  for (let redirect = 0; redirect < 6; redirect++) {
    const target = new URL(url);
    if (
      target.protocol !== 'https:' ||
      !allowedHosts.has(target.hostname) ||
      target.username ||
      target.password ||
      (target.port && target.port !== '443')
    )
      throw new Error('La actualización apunta a un servidor no autorizado.');
    const response = await fetcher(target, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'AguachilesPOS-ManualUpdater/1.0',
        Accept: 'application/vnd.github+json',
      },
      signal: signal
        ? AbortSignal.any([AbortSignal.timeout(timeoutMs), signal])
        : AbortSignal.timeout(timeoutMs),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('Redirección de descarga incompleta.');
      url = new URL(location, target).href;
      continue;
    }
    return response;
  }
  throw new Error('Demasiadas redirecciones al descargar la actualización.');
}
export async function limitedBytes(response, limit) {
  if (!response.ok)
    throw new Error(
      `No se pudo consultar GitHub (${response.status}). Revisa la conexión o inténtalo más tarde.`,
    );
  const pieces = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit)
      throw new Error('La respuesta de actualizaciones excede el tamaño permitido.');
    pieces.push(Buffer.from(chunk));
  }
  return Buffer.concat(pieces);
}
