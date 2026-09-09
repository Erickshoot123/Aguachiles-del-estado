import type { LoginRequest, LoginResponse, RefreshResponse } from '@aguachiles/shared';
import { apiRequest } from '../../lib/apiClient';

export function login(input: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/login', { method: 'POST', body: input });
}

export function refresh(refreshToken: string): Promise<RefreshResponse> {
  return apiRequest<RefreshResponse>('/api/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

export function logout(refreshToken: string): Promise<void> {
  return apiRequest<void>('/api/auth/logout', { method: 'POST', body: { refreshToken } });
}
