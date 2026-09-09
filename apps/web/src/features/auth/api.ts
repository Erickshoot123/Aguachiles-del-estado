import type { LoginRequest, LoginResponse } from '@aguachiles/shared';
import { apiRequest } from '../../lib/apiClient';

export function login(input: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/login', { method: 'POST', body: input });
}
