import type {
  CashMovement,
  CashRegister,
  CashSession,
  CreateCashMovementRequest,
} from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';

export function listCashRegisters(): Promise<CashRegister[]> {
  return authFetch<CashRegister[]>('/api/cash-registers');
}

export function getCurrentCashSession(cashRegisterId: string): Promise<CashSession | null> {
  const params = new URLSearchParams({ cashRegisterId });
  return authFetch<CashSession | null>(`/api/cash-sessions/current?${params.toString()}`);
}

export function openCashSession(
  cashRegisterId: string,
  openingAmount: number,
): Promise<CashSession> {
  return authFetch<CashSession>('/api/cash-sessions', {
    method: 'POST',
    body: { cashRegisterId, openingAmount },
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
