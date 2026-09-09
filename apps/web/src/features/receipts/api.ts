import type { Ticket } from '@aguachiles/shared';
import { apiRequest } from '../../lib/apiClient';
import { env } from '../../lib/env';

interface ReceiptResponse {
  ticket: Ticket;
  reprintCount: number;
}

export function getReceipt(token: string, orderId: string): Promise<ReceiptResponse> {
  return apiRequest<ReceiptResponse>(`/api/orders/${orderId}/receipt`, { token });
}

export function confirmPrinted(token: string, orderId: string): Promise<void> {
  return apiRequest<void>(`/api/orders/${orderId}/receipt/printed`, { method: 'POST', token });
}

export function printAtAgent(ticket: Ticket): Promise<void> {
  return apiRequest<void>('/print', {
    method: 'POST',
    body: ticket,
    baseUrl: env.VITE_PRINT_AGENT_URL,
  });
}
