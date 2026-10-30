import { spawn, fork } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';

export function run(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, ...options, stdio: options.ignoreOutput ? 'ignore' : ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let error = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Tiempo agotado: ${file.split(/[\\/]/).pop()}`)); }, 180000);
    child.stdout?.on('data', (chunk) => { output += chunk; });
    child.stderr?.on('data', (chunk) => { error += chunk; });
    child.on('error', (cause) => { clearTimeout(timer); reject(cause); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 || options.allowFailure) resolve({ code, output, error });
      else reject(new Error(`${file.split(/[\\/]/).pop()} terminó con código ${code}: ${error.slice(-2000)}`));
    });
    child.stdin?.on('error', () => {});
    child.stdin?.end(options.input ?? '');
  });
}

export function startService(file, cwd, env, logPath) {
  const fd = openSync(logPath, 'a');
  try { return fork(file, [], { cwd, env, execArgv: [], windowsHide: true, stdio: ['ignore', fd, fd, 'ipc'] }); }
  finally { closeSync(fd); }
}

export async function stopService(child) {
  if (!child || child.exitCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill(); resolve(); }, 12000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    if (child.connected) child.send('shutdown', () => {});
    else { child.kill(); clearTimeout(timer); resolve(); }
  });
}

export async function waitHttp(url, timeout = 60000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* Aún iniciando. */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`No se inició el servicio local en ${new URL(url).port}. Revisa los registros.`);
}
