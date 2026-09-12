import {
  characterSet as CharacterSet,
  printer as ThermalPrinter,
  types as PrinterTypes,
} from 'node-thermal-printer';
import type { Ticket } from '../ticket.js';
import { renderTicketCommands } from './renderTicketCommands.js';

export class PrintFailedError extends Error {
  constructor(cause: unknown) {
    super('No se pudo imprimir el ticket después de varios intentos');
    this.name = 'PrintFailedError';
    this.cause = cause;
  }
}

export interface PrintToInterfaceOptions {
  /** Destino ESC/POS: ruta de archivo, `tcp://<ip>:<puerto>` o `printer:<nombre>`. */
  interfaceString: string;
  ticket: Ticket;
  width: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Renderiza y envía un ticket a cualquier interfaz ESC/POS soportada por
 * node-thermal-printer, con reintentos. Es el único lugar que arma un
 * `ThermalPrinter` y ejecuta la impresión: el Print Agent (modo local y
 * cuando reenvía a otra impresora) y el backend (modo impresora de red)
 * pasan por aquí para que el ticket resultante sea siempre el mismo.
 */
export async function printTicketToInterface(options: PrintToInterfaceOptions): Promise<void> {
  const { interfaceString, ticket, width, maxRetries = 3, retryDelayMs = 500 } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: interfaceString,
        width,
        // WPC1252 cubre acentos y ñ; sin esto, node-thermal-printer busca a
        // tientas entre todas las tablas de códigos en cada carácter no-ASCII.
        characterSet: CharacterSet.WPC1252,
      });
      renderTicketCommands(printer, ticket);
      await printer.execute();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await wait(retryDelayMs);
      }
    }
  }

  throw new PrintFailedError(lastError);
}
