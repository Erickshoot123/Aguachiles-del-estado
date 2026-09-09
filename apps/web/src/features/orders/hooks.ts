import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateOrderRequest } from '@aguachiles/shared';
import { useAuthStore } from '../auth/authStore';
import { advanceOrder, cancelOrder, chargeOrder, createOrder, listOrders, listProducts } from './api';

const ORDERS_QUERY_KEY = ['orders'] as const;
const PRODUCTS_QUERY_KEY = ['products'] as const;

export function useOrders() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ORDERS_QUERY_KEY,
    queryFn: () => listOrders(accessToken as string),
    enabled: Boolean(accessToken),
    refetchInterval: 15000,
  });
}

export function useProducts() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: () => listProducts(accessToken as string),
    enabled: Boolean(accessToken),
  });
}

export function useCreateOrder() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOrderRequest) => createOrder(accessToken as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}

export function useAdvanceOrder() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => advanceOrder(accessToken as string, orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}

export function useCancelOrder() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => cancelOrder(accessToken as string, orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}

export function useChargeOrder() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => chargeOrder(accessToken as string, orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}
