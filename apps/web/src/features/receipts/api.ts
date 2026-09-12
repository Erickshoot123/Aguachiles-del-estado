import type { AgentPrinter, PrintTarget, Ticket } from '@aguachiles/shared';
import { apiRequest } from '../../lib/apiClient';
import { authFetch } from '../../lib/authFetch';
import { env } from '../../lib/env';

interface ReceiptResponse {
  ticket: Ticket;
  reprintCount: number;
}

export function getReceipt(orderId: string): Promise<ReceiptResponse> {
  return authFetch<ReceiptResponse>(`/api/orders/${orderId}/receipt`);
}

export function confirmPrinted(orderId: string): Promise<void> {
  return authFetch<void>(`/api/orders/${orderId}/receipt/printed`, { method: 'POST' });
}

/** Modo "agente_local": el navegador de esta terminal llama a su propio Print Agent. */
export function printAtAgent(ticket: Ticket, printerId: string | null): Promise<void> {
  return apiRequest<void>('/print', {
    method: 'POST',
    body: { ticket, printerId: printerId ?? undefined },
    baseUrl: env.VITE_PRINT_AGENT_URL,
  });
}

export function listAgentPrinters(): Promise<AgentPrinter[]> {
  return apiRequest<AgentPrinter[]>('/printers', { baseUrl: env.VITE_PRINT_AGENT_URL });
}

/**
 * Modos "red" y "otra_terminal": esta terminal (ej. una tablet sin Print
 * Agent) no puede abrir un socket TCP ni siempre puede llegar al agente de
 * otra terminal, así que es el backend quien envía el ticket.
 */
export function printViaBackend(
  orderId: string,
  target: Exclude<PrintTarget, { mode: 'agente_local' }>,
  printerId: string | null,
): Promise<void> {
  return authFetch<void>(`/api/orders/${orderId}/receipt/print`, {
    method: 'POST',
    body: { target, printerId: printerId ?? undefined },
  });
}
