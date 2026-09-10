import type { CashMovement, CashSession, CreateCashMovementRequest } from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';

export function getCurrentCashSession(): Promise<CashSession | null> {
  return authFetch<CashSession | null>('/api/cash-sessions/current');
}

export function openCashSession(openingAmount: number): Promise<CashSession> {
  return authFetch<CashSession>('/api/cash-sessions', {
    method: 'POST',
    body: { openingAmount },
  });
}

export function closeCashSession(
  sessionId: string,
  actualClosingAmount: number,
): Promise<CashSession> {
  return authFetch<CashSession>(`/api/cash-sessions/${sessionId}/close`, {
    method: 'PATCH',
    body: { actualClosingAmount },
  });
}

export function listCashMovements(sessionId: string): Promise<CashMovement[]> {
  return authFetch<CashMovement[]>(`/api/cash-sessions/${sessionId}/movements`);
}

export function createCashMovement(
  sessionId: string,
  input: CreateCashMovementRequest,
): Promise<CashMovement> {
  return authFetch<CashMovement>(`/api/cash-sessions/${sessionId}/movements`, {
    method: 'POST',
    body: input,
  });
}
