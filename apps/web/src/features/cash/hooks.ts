import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../auth/authStore';
import { closeCashSession, getCurrentCashSession, openCashSession } from './api';

export const CASH_SESSION_QUERY_KEY = ['cash-session', 'current'] as const;

export function useCurrentCashSession() {
  const isLoggedIn = useAuthStore((state) => Boolean(state.accessToken));

  return useQuery({
    queryKey: CASH_SESSION_QUERY_KEY,
    queryFn: getCurrentCashSession,
    enabled: isLoggedIn,
  });
}

export function useOpenCashSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (openingAmount: number) => openCashSession(openingAmount),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CASH_SESSION_QUERY_KEY });
    },
  });
}

export function useCloseCashSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      actualClosingAmount,
    }: {
      sessionId: string;
      actualClosingAmount: number;
    }) => closeCashSession(sessionId, actualClosingAmount),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CASH_SESSION_QUERY_KEY });
    },
  });
}
