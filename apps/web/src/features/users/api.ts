import type { ResetPasswordRequest, UserSummary } from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';

export function listUsers(): Promise<UserSummary[]> {
  return authFetch<UserSummary[]>('/api/auth/users');
}

export function resetUserPassword(userId: string, input: ResetPasswordRequest): Promise<void> {
  return authFetch<void>(`/api/auth/users/${userId}/reset-password`, {
    method: 'POST',
    body: input,
  });
}
