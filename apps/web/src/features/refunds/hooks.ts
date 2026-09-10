import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRefundRequest } from '@aguachiles/shared';
import { useIsLoggedIn } from '../auth/authStore';
import { createRefund, getRefundableSale } from './api';

function refundableQueryKey(orderId: string) {
  return ['refundable', orderId] as const;
}

export function useRefundableSale(orderId: string, enabled: boolean) {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: refundableQueryKey(orderId),
    queryFn: () => getRefundableSale(orderId),
    enabled: enabled && isLoggedIn,
  });
}

export function useCreateRefund(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRefundRequest) => createRefund(orderId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: refundableQueryKey(orderId) });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['order-lookup'] });
      void queryClient.invalidateQueries({ queryKey: ['cash-session', 'current'] });
    },
  });
}
