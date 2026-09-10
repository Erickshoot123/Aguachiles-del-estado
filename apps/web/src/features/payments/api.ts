import type { PaymentMethod } from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';

export function listPaymentMethods(): Promise<PaymentMethod[]> {
  return authFetch<PaymentMethod[]>('/api/payment-methods');
}
