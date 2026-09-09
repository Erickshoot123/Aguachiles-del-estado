import { useQuery } from '@tanstack/react-query';
import { useIsLoggedIn } from '../auth/authStore';
import { getCashSessionHistory, getSalesReport } from './api';

export function useSalesReport(from: string, to: string) {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: ['reports', 'sales', from, to] as const,
    queryFn: () => getSalesReport(from, to),
    enabled: isLoggedIn,
  });
}

export function useCashSessionHistory() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: ['reports', 'cash-sessions'] as const,
    queryFn: getCashSessionHistory,
    enabled: isLoggedIn,
  });
}
