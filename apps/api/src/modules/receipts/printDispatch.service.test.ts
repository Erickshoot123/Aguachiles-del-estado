import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { createServer as createTcpServer, type Server as TcpServer } from 'node:net';
import type { Ticket } from '@aguachiles/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { dispatchPrint } from './printDispatch.service.js';

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

async function listenOnEphemeralPort(server: TcpServer | HttpServer): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('No se pudo determinar el puerto del servidor de prueba');
  }
  return address.port;
}

describe('dispatchPrint — modo "red" (impresora de red por TCP)', () => {
  let server: TcpServer | undefined;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  });

  it('envía el ticket ESC/POS por TCP al host y puerto configurados', async () => {
    const received: Buffer[] = [];
    let resolveClosed: () => void;
    const closed = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });
    server = createTcpServer((socket) => {
      socket.on('data', (chunk) => received.push(chunk));
      // node-thermal-printer cierra la conexión justo después de escribir sin
      // esperar un ack, así que el 'data' de este socket y la resolución de
      // dispatchPrint() corren en paralelo. Node sí garantiza que todo 'data'
      // llega antes de 'close', así que esperamos ese evento antes de leer.
      socket.on('close', () => resolveClosed());
    });
    const port = await listenOnEphemeralPort(server);

    const ticket = sampleTicket();
    await dispatchPrint(ticket, { mode: 'red', host: '127.0.0.1', port }, undefined);
    await closed;

    const payload = Buffer.concat(received).toString('latin1');
    expect(payload).toContain(ticket.ticketNumber);
    expect(payload).toContain('Aguachile verde');
  });

  it('lanza un error claro si la impresora de red no responde', async () => {
    server = createTcpServer();
    const port = await listenOnEphemeralPort(server);
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;

    await expect(
      dispatchPrint(sampleTicket(), { mode: 'red', host: '127.0.0.1', port }, undefined),
    ).rejects.toThrow();
  });
});

describe('dispatchPrint — modo "otra_terminal" (reenvío al Print Agent de otra terminal)', () => {
  let server: HttpServer | undefined;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  });

  it('reenvía el ticket y el printerId al endpoint /print del agente remoto', async () => {
    let receivedBody: unknown;
    server = createHttpServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        receivedBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'printed' }));
      });
    });
    const port = await listenOnEphemeralPort(server);

    const ticket = sampleTicket();
    await dispatchPrint(
      ticket,
      { mode: 'otra_terminal', agentUrl: `http://127.0.0.1:${port}` },
      'cocina',
    );

    expect(receivedBody).toMatchObject({ ticket: { ticketNumber: ticket.ticketNumber }, printerId: 'cocina' });
  });

  it('lanza un error claro si el agente remoto responde con error', async () => {
    server = createHttpServer((_request, response) => {
      response.writeHead(502);
      response.end();
    });
    const port = await listenOnEphemeralPort(server);

    await expect(
      dispatchPrint(
        sampleTicket(),
        { mode: 'otra_terminal', agentUrl: `http://127.0.0.1:${port}` },
        undefined,
      ),
    ).rejects.toThrow('El Print Agent de la otra terminal no pudo imprimir el ticket');
  });

  it('lanza un error claro si el agente remoto es inalcanzable', async () => {
    await expect(
      dispatchPrint(
        sampleTicket(),
        { mode: 'otra_terminal', agentUrl: 'http://127.0.0.1:1' },
        undefined,
      ),
    ).rejects.toThrow('No se pudo contactar al Print Agent de la otra terminal');
  });
});
