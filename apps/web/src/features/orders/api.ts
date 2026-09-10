import type { CreateOrderRequest, Order, ProductSummary } from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';

export function listOrders(): Promise<Order[]> {
  return authFetch<Order[]>('/api/orders');
}

export function createOrder(input: CreateOrderRequest): Promise<Order> {
  return authFetch<Order>('/api/orders', { method: 'POST', body: input });
}

export function advanceOrder(orderId: string): Promise<Order> {
  return authFetch<Order>(`/api/orders/${orderId}/advance`, { method: 'PATCH' });
}

export function cancelOrder(orderId: string): Promise<Order> {
  return authFetch<Order>(`/api/orders/${orderId}/cancel`, { method: 'PATCH' });
}

export function chargeOrder(orderId: string): Promise<Order> {
  return authFetch<Order>(`/api/orders/${orderId}/charge`, { method: 'PATCH' });
}

export function listProducts(): Promise<ProductSummary[]> {
  return authFetch<ProductSummary[]>('/api/products');
}

export function lookupOrderByTicketNumber(ticketNumber: string): Promise<Order> {
  const params = new URLSearchParams({ ticketNumber });
  return authFetch<Order>(`/api/orders/lookup?${params.toString()}`);
}
