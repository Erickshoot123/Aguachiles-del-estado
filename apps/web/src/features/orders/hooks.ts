import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateOrderRequest } from '@aguachiles/shared';
import { useIsLoggedIn } from '../auth/authStore';
import { CASH_SESSION_QUERY_KEY } from '../cash/hooks';
import { advanceOrder, cancelOrder, chargeOrder, createOrder, listOrders, listProducts } from './api';

const ORDERS_QUERY_KEY = ['orders'] as const;
const PRODUCTS_QUERY_KEY = ['products'] as const;

export function useOrders() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: ORDERS_QUERY_KEY,
    queryFn: listOrders,
    enabled: isLoggedIn,
    refetchInterval: 15000,
  });
}

export function useProducts() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: listProducts,
    enabled: isLoggedIn,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOrderRequest) => createOrder(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}

export function useAdvanceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => advanceOrder(orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}

export function useChargeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => chargeOrder(orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: CASH_SESSION_QUERY_KEY });
    },
  });
}
