import type { PrintTarget, Ticket } from '@aguachiles/shared';
import { printTicketToInterface } from '@aguachiles/shared/printing';

// Mismos valores por defecto que usa el Print Agent (apps/print-agent/src/config/env.ts)
// para que el ticket ocupe el mismo ancho sin importar qué camino tomó.
const PRINTER_WIDTH_58 = 32;
const PRINTER_WIDTH_80 = 42;

function resolveWidth(format: Ticket['format']): number {
  return format === 'thermal_58' ? PRINTER_WIDTH_58 : PRINTER_WIDTH_80;
}

async function printToNetworkPrinter(ticket: Ticket, host: string, port: number): Promise<void> {
  await printTicketToInterface({
    interfaceString: `tcp://${host}:${port}`,
    ticket,
    width: resolveWidth(ticket.format),
  });
}

async function printToOtherTerminalAgent(
  ticket: Ticket,
  agentUrl: string,
  printerId: string | undefined,
): Promise<void> {
  const url = `${agentUrl.replace(/\/+$/, '')}/print`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, printerId }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    throw new Error('No se pudo contactar al Print Agent de la otra terminal', { cause: error });
  }

  if (!response.ok) {
    throw new Error('El Print Agent de la otra terminal no pudo imprimir el ticket');
  }
}

/**
 * Despacha un ticket ya construido hacia un destino que no es el agente
 * local (ese lo maneja el navegador de la propia terminal, sin pasar por
 * aquí). Ambos caminos terminan usando el mismo renderizador de ticket que
 * el Print Agent (ver printTicketToInterface), así que el resultado
 * impreso es idéntico al del modo "agente local".
 */
export async function dispatchPrint(
  ticket: Ticket,
  target: Exclude<PrintTarget, { mode: 'agente_local' }>,
  printerId: string | undefined,
): Promise<void> {
  if (target.mode === 'red') {
    await printToNetworkPrinter(ticket, target.host, target.port);
    return;
  }
  await printToOtherTerminalAgent(ticket, target.agentUrl, printerId);
}
