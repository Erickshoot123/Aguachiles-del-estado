import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCashMovementRequest } from '@aguachiles/shared';
import { useIsLoggedIn } from '../auth/authStore';
import {
  closeCashSession,
  createCashMovement,
  getCurrentCashSession,
  listCashMovements,
  openCashSession,
} from './api';

export const CASH_SESSION_QUERY_KEY = ['cash-session', 'current'] as const;

function cashMovementsQueryKey(sessionId: string) {
  return ['cash-movements', sessionId] as const;
}

export function useCurrentCashSession() {
  const isLoggedIn = useIsLoggedIn();

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

export function useCashMovements(sessionId: string) {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: cashMovementsQueryKey(sessionId),
    queryFn: () => listCashMovements(sessionId),
    enabled: isLoggedIn && sessionId !== '',
  });
}

export function useCreateCashMovement(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCashMovementRequest) => createCashMovement(sessionId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cashMovementsQueryKey(sessionId) });
      void queryClient.invalidateQueries({ queryKey: CASH_SESSION_QUERY_KEY });
    },
  });
}
