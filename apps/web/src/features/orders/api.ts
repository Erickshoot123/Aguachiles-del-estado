import type { CreateOrderRequest, Order, ProductSummary } from '@aguachiles/shared';
import { apiRequest } from '../../lib/apiClient';

export function listOrders(token: string): Promise<Order[]> {
  return apiRequest<Order[]>('/api/orders', { token });
}

export function createOrder(token: string, input: CreateOrderRequest): Promise<Order> {
  return apiRequest<Order>('/api/orders', { method: 'POST', body: input, token });
}

export function advanceOrder(token: string, orderId: string): Promise<Order> {
  return apiRequest<Order>(`/api/orders/${orderId}/advance`, { method: 'PATCH', token });
}

export function cancelOrder(token: string, orderId: string): Promise<Order> {
  return apiRequest<Order>(`/api/orders/${orderId}/cancel`, { method: 'PATCH', token });
}

export function listProducts(token: string): Promise<ProductSummary[]> {
  return apiRequest<ProductSummary[]>('/api/products', { token });
}
