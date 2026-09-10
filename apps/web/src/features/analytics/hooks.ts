import { useQuery } from '@tanstack/react-query';
import { useIsLoggedIn } from '../auth/authStore';
import { getAnalyticsDashboard } from './api';

export function useAnalyticsDashboard(from: string, to: string) {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: ['analytics', 'dashboard', from, to] as const,
    queryFn: () => getAnalyticsDashboard(from, to),
    enabled: isLoggedIn,
  });
}
