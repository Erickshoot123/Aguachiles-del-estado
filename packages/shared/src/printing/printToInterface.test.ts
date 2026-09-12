import { readFile, unlink } from 'node:fs/promises';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Ticket } from '../ticket.js';
import { PrintFailedError, printTicketToInterface } from './printToInterface.js';

function sampleTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    saleId: '11111111-1111-1111-1111-111111111111',
    ticketNumber: 'A-0042',
    format: 'thermal_80',
    issuedAt: new Date('2026-01-15T20:30:00.000Z').toISOString(),
    businessName: 'Aguachiles del Estado',
    lines: [{ productName: 'Aguachile verde', quantity: 2, unitPrice: 120, subtotal: 240 }],
    subtotal: 240,
    taxTotal: 0,
    discountTotal: 0,
    total: 240,
    isReprint: false,
    ...overrides,
  };
}

async function listenOnEphemeralPort(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('No se pudo determinar el puerto del servidor de prueba');
  }
  return address.port;
}

/**
 * node-thermal-printer cierra la conexión abruptamente justo después de
 * escribir (sin esperar un ack), así que el evento 'data' de nuestro
 * servidor de prueba y la resolución de `execute()` corren en paralelo: no
 * hay garantía de orden entre ellos. Node sí garantiza que todo 'data' de
 * un socket llega antes de su 'close', así que esperamos ese evento en vez
 * de leer `received` justo después del await.
 */
function createTcpSink(): { server: Server; received: Buffer[]; closed: Promise<void> } {
  const received: Buffer[] = [];
  let resolveClosed: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  const server = createServer((socket) => {
    socket.on('data', (chunk) => received.push(chunk));
    socket.on('close', () => resolveClosed());
  });
  return { server, received, closed };
}

describe('printTicketToInterface', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  });

  it('envía el ticket renderizado como bytes ESC/POS a una impresora de red simulada por TCP', async () => {
    const sink = createTcpSink();
    server = sink.server;
    const port = await listenOnEphemeralPort(server);

    const ticket = sampleTicket();
    await printTicketToInterface({
      interfaceString: `tcp://127.0.0.1:${port}`,
      ticket,
      width: 42,
    });
    await sink.closed;

    const payload = Buffer.concat(sink.received).toString('latin1');
    expect(payload).toContain(ticket.ticketNumber);
    expect(payload).toContain('AGUACHILES DEL ESTADO');
    expect(payload).toContain('Aguachile verde');
    expect(payload).toContain('$240.00');
  });

  it('el ticket es idéntico (mismos bytes) sin importar la interfaz ESC/POS de destino', async () => {
    const sink = createTcpSink();
    server = sink.server;
    const port = await listenOnEphemeralPort(server);

    const ticket = sampleTicket({ ticketNumber: 'A-0099' });
    const outputPath = join(tmpdir(), `aguachiles-print-test-${Date.now()}.bin`);

    await printTicketToInterface({ interfaceString: outputPath, ticket, width: 42 });
    await printTicketToInterface({
      interfaceString: `tcp://127.0.0.1:${port}`,
      ticket,
      width: 42,
    });
    await sink.closed;

    const fileBuffer = await readFile(outputPath);
    await unlink(outputPath);

    expect(Buffer.concat(sink.received).equals(fileBuffer)).toBe(true);
  });

  it('reintenta y finalmente lanza PrintFailedError si la impresora de red no responde', async () => {
    // Puerto sin nada escuchando: la conexión se rechaza de inmediato (ECONNREFUSED).
    server = createServer();
    const port = await listenOnEphemeralPort(server);
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;

    await expect(
      printTicketToInterface({
        interfaceString: `tcp://127.0.0.1:${port}`,
        ticket: sampleTicket(),
        width: 42,
        maxRetries: 2,
        retryDelayMs: 10,
      }),
    ).rejects.toBeInstanceOf(PrintFailedError);
  });
});
