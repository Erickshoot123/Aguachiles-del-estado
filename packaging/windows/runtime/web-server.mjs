import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' };

export async function startWebServer(directory, port) {
  const root = resolve(directory);
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = resolve(root, `.${path}`);
      if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
      let data;
      let type = MIME[extname(file)] ?? 'application/octet-stream';
      try { data = await readFile(file); }
      catch {
        if (extname(path)) { response.writeHead(404).end(); return; }
        data = await readFile(resolve(root, 'index.html'));
        type = MIME['.html'];
      }
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      response.end(data);
    } catch { response.writeHead(400).end(); }
  });
  await new Promise((resolveReady, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolveReady); });
  return server;
}
