import type { CreateUserRequest, ResetPasswordRequest, UserSummary } from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';

export function listUsers(): Promise<UserSummary[]> {
  return authFetch<UserSummary[]>('/api/auth/users');
}

export function createUser(input: CreateUserRequest): Promise<UserSummary> {
  return authFetch<UserSummary>('/api/auth/users', { method: 'POST', body: input });
}

export function setUserStatus(userId: string, isActive: boolean): Promise<void> {
  return authFetch<void>(`/api/auth/users/${userId}/status`, {
    method: 'PATCH',
    body: { isActive },
  });
}

export function resetUserPassword(userId: string, input: ResetPasswordRequest): Promise<void> {
  return authFetch<void>(`/api/auth/users/${userId}/reset-password`, {
    method: 'POST',
    body: input,
  });
}
