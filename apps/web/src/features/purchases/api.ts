import type { CreatePurchaseRequest, Purchase } from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';

export function listPurchases(): Promise<Purchase[]> {
  return authFetch<Purchase[]>('/api/purchases');
}

export function createPurchase(input: CreatePurchaseRequest): Promise<Purchase> {
  return authFetch<Purchase>('/api/purchases', { method: 'POST', body: input });
}
