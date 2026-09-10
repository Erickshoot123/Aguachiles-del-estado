import { useQuery } from '@tanstack/react-query';
import { useIsLoggedIn } from '../auth/authStore';
import { listAuditLogs } from './api';

export function useAuditLogs() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: ['audit-logs'] as const,
    queryFn: listAuditLogs,
    enabled: isLoggedIn,
  });
}
