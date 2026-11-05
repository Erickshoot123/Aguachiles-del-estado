import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { UpdateManager } from './manager.mjs';

export function pausePrinter(printer) {
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const cleanup = () => {
      clearTimeout(timer);
      printer.off('message', receive);
    };
    const receive = (message) => {
      if (message?.type !== 'printer-update-result' || message.id !== id) return;
      cleanup();
      if (message.ready) resolve();
      else reject(new Error('Hay una impresión en curso. Espera a que termine antes de instalar.'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('No se pudo pausar la impresora. No se instalará la actualización.'));
    }, 10000);
    printer.on('message', receive);
    printer.send({ type: 'prepare-update', id }, (error) => {
      if (error) {
        cleanup();
        reject(error);
      }
    });
  });
}
export async function registerUpdates({ root, appDir, api, printer, database }) {
  const manifest = JSON.parse(await readFile(join(appDir, 'manifest.json'), 'utf8'));
  const manager = new UpdateManager({
    root,
    appDir,
    installedVersion: manifest.version,
    prepareInstall: async () => {
      await pausePrinter(printer);
      try {
        // Respaldo con el negocio detenido y antes de modificar cualquier archivo del programa.
        await database.backup('antes-de-actualizacion-manual');
        await new Promise((resolve, reject) => {
          const child = spawn(join(appDir, 'UpdateRunner.exe'), [`/root=${root}`], {
            cwd: appDir,
            detached: true,
            windowsHide: false,
            stdio: 'ignore',
          });
          child.once('error', reject);
          child.once('exit', (code) => {
            if (code !== 0) {
              manager.state = {
                ...manager.state,
                phase: 'error',
                message: 'No se pudo iniciar la instalación. Revisa el mensaje del actualizador.',
              };
              if (printer.connected) printer.send({ type: 'resume-update' }, () => {});
            }
          });
          child.once('spawn', () => {
            child.unref();
            resolve();
          });
        });
      } catch (error) {
        printer.send({ type: 'resume-update' }, () => {});
        throw error;
      }
    },
  });
  await manager.initialize();
  api.on('message', (message) => {
    if (
      message?.type !== 'update-action' ||
      typeof message.id !== 'string' ||
      !['status', 'check', 'download', 'install'].includes(message.action)
    )
      return;
    try {
      api.send(
        { type: 'update-result', id: message.id, result: manager.action(message.action) },
        () => {},
      );
    } catch (error) {
      api.send({ type: 'update-result', id: message.id, error: error.message }, () => {});
    }
  });
  return manager;
}
