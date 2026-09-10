import { useQuery } from '@tanstack/react-query';
import { useIsLoggedIn } from '../auth/authStore';
import { listPaymentMethods } from './api';

export function usePaymentMethods() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: ['payment-methods'] as const,
    queryFn: listPaymentMethods,
    enabled: isLoggedIn,
    staleTime: 60_000,
  });
}
