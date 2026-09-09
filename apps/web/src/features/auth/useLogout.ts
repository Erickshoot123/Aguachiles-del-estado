import { logout } from './api';
import { useAuthStore } from './authStore';

export function useLogout(): () => void {
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);

  return () => {
    if (refreshToken) {
      void logout(refreshToken).catch(() => undefined);
    }
    clearSession();
  };
}
