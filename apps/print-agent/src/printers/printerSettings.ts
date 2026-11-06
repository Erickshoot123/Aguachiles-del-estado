import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { printerSelectionSchema, type PrinterSelection as Selection } from '@aguachiles/shared';
import type { Env, PrinterConfig } from '../config/env.js';
import { listWindowsPrinters } from './windowsPrinters.js';

export class PrinterSettings {
  private readonly initial: PrinterConfig;
  private selection: Selection = { printerId: 'configured', qrMode: 'raster' };
  constructor(
    private env: Env,
    private discover = listWindowsPrinters,
  ) {
    this.initial = { ...env.PRINTERS[0]! };
    this.selection.qrMode = this.initial.qrMode;
  }
  async initialize() {
    let content: string;
    try {
      content = await readFile(this.env.PRINTER_SETTINGS_FILE, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    const stored = z
      .object({ initialInterface: z.string(), selection: printerSelectionSchema })
      .parse(JSON.parse(content));
    // Cambiar la impresora desde el asistente nativo tiene prioridad sobre el ajuste anterior.
    if (stored.initialInterface !== this.initial.interface) return;
    this.selection = stored.selection;
    this.apply();
  }
  private apply() {
    const selected = this.selection;
    let target = { ...this.initial, qrMode: selected.qrMode };
    if (selected.printerId.startsWith('windows:')) {
      const name = Buffer.from(selected.printerId.slice(8), 'base64url').toString('utf8');
      target = { ...target, name, interface: `printer:${name}` };
    } else if (selected.printerId === 'network' && selected.network) {
      target = {
        ...target,
        name: `Red ${selected.network.host}:${selected.network.port}`,
        interface: `tcp://${selected.network.host}:${selected.network.port}`,
      };
    }
    this.env.PRINTERS[0] = target;
  }
  async status() {
    let warning: string | null = null;
    const windows = await this.discover().catch(() => {
      warning =
        'No se pudo consultar Windows. Revisa que el servicio de cola de impresión esté activo y pulsa Actualizar lista.';
      return [];
    });
    if (
      this.selection.printerId.startsWith('windows:') &&
      !windows.some((printer) => printer.id === this.selection.printerId)
    )
      warning ??=
        'La impresora guardada no aparece en Windows. No se cambiará por otra automáticamente; revisa la conexión o selecciona otra.';
    return {
      ...this.selection,
      activePrinterId: this.env.PRINTERS[0]!.id,
      activeName: this.env.PRINTERS[0]!.name,
      warning,
      printers: [
        {
          id: 'configured',
          name: this.initial.name,
          kind: this.initial.interface.startsWith('printer:')
            ? 'windows'
            : this.initial.interface.startsWith('tcp://')
              ? 'network'
              : 'file',
          port: null,
          driver: null,
          offline: null,
        },
        ...windows,
      ],
    };
  }
  async save(selection: Selection) {
    if (selection.printerId === 'network' && !selection.network)
      throw new Error('Indica la IP y el puerto de la impresora de red.');
    if (!['configured', 'network'].includes(selection.printerId)) {
      const printers = await this.discover();
      if (!printers.some((printer) => printer.id === selection.printerId))
        throw new Error(
          'La impresora ya no aparece en Windows. Actualiza la lista y vuelve a seleccionarla.',
        );
    }
    await mkdir(dirname(this.env.PRINTER_SETTINGS_FILE), { recursive: true });
    const temp = this.env.PRINTER_SETTINGS_FILE + '.' + randomUUID() + '.tmp';
    await writeFile(temp, JSON.stringify({ initialInterface: this.initial.interface, selection }), {
      flag: 'wx',
    });
    await rename(temp, this.env.PRINTER_SETTINGS_FILE);
    this.selection = selection;
    this.apply();
  }
}
