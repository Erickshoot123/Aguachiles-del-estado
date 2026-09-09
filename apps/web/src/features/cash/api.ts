import type { CashSession } from '@aguachiles/shared';
import { apiRequest } from '../../lib/apiClient';

export function getCurrentCashSession(token: string): Promise<CashSession | null> {
  return apiRequest<CashSession | null>('/api/cash-sessions/current', { token });
}

export function openCashSession(token: string, openingAmount: number): Promise<CashSession> {
  return apiRequest<CashSession>('/api/cash-sessions', {
    method: 'POST',
    body: { openingAmount },
    token,
  });
}

export function closeCashSession(
  token: string,
  sessionId: string,
  actualClosingAmount: number,
): Promise<CashSession> {
  return apiRequest<CashSession>(`/api/cash-sessions/${sessionId}/close`, {
    method: 'PATCH',
    body: { actualClosingAmount },
    token,
  });
}
