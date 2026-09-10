import type { CreateRefundRequest, RefundableSale, RefundResult } from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';

export function getRefundableSale(orderId: string): Promise<RefundableSale> {
  return authFetch<RefundableSale>(`/api/orders/${orderId}/refundable`);
}

export function createRefund(orderId: string, input: CreateRefundRequest): Promise<RefundResult> {
  return authFetch<RefundResult>(`/api/orders/${orderId}/refund`, { method: 'POST', body: input });
}
