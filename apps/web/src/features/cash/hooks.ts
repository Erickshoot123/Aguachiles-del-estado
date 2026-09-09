import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../auth/authStore';
import { closeCashSession, getCurrentCashSession, openCashSession } from './api';

const CASH_SESSION_QUERY_KEY = ['cash-session', 'current'] as const;

export function useCurrentCashSession() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: CASH_SESSION_QUERY_KEY,
    queryFn: () => getCurrentCashSession(accessToken as string),
    enabled: Boolean(accessToken),
  });
}

export function useOpenCashSession() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (openingAmount: number) => openCashSession(accessToken as string, openingAmount),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CASH_SESSION_QUERY_KEY });
    },
  });
}

export function useCloseCashSession() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, actualClosingAmount }: { sessionId: string; actualClosingAmount: number }) =>
      closeCashSession(accessToken as string, sessionId, actualClosingAmount),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CASH_SESSION_QUERY_KEY });
    },
  });
}
