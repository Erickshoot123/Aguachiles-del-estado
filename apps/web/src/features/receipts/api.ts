import type { Ticket } from '@aguachiles/shared';
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

export function printAtAgent(ticket: Ticket): Promise<void> {
  return apiRequest<void>('/print', {
    method: 'POST',
    body: ticket,
    baseUrl: env.VITE_PRINT_AGENT_URL,
  });
}
