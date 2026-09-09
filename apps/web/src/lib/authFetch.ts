import { refresh } from '../features/auth/api';
import { useAuthStore } from '../features/auth/authStore';
import { ApiError, apiRequest } from './apiClient';

interface AuthFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  baseUrl?: string;
}

let pendingRefresh: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setSession, clearSession } = useAuthStore.getState();
  if (!refreshToken) {
    clearSession();
    return null;
  }

  try {
    const response = await refresh(refreshToken);
    setSession(response.accessToken, response.refreshToken, response.user);
    return response.accessToken;
  } catch {
    clearSession();
    return null;
  }
}

/**
 * Deduplica renovaciones concurrentes: el refresh token rota en cada uso
 * (se revoca al usarse), así que dos llamadas simultáneas con el mismo
 * token viejo harían fallar a una de las dos. Todo el que necesite un
 * access token fresco debe pasar por aquí, nunca llamar a refresh() directo.
 */
export function refreshOnce(): Promise<string | null> {
  pendingRefresh ??= refreshAccessToken().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
}

/**
 * Como apiRequest, pero lee el access token actual del store y, ante un 401,
 * intenta renovarlo una vez (reusando una renovación en curso si ya hay una)
 * antes de reintentar la solicitud original.
 */
export async function authFetch<TResponse>(
  path: string,
  options: AuthFetchOptions = {},
): Promise<TResponse> {
  const accessToken = useAuthStore.getState().accessToken;

  try {
    return await apiRequest<TResponse>(path, { ...options, token: accessToken });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    const newAccessToken = await refreshOnce();
    if (!newAccessToken) {
      throw error;
    }

    return apiRequest<TResponse>(path, { ...options, token: newAccessToken });
  }
}
