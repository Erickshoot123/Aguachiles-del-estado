import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, PermissionCode } from '@aguachiles/shared';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isBootstrapping: boolean;
  setSession: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  setBootstrapped: () => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isBootstrapping: true,
      setSession: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user, isBootstrapping: false }),
      setBootstrapped: () => set({ isBootstrapping: false }),
      clearSession: () =>
        set({ accessToken: null, refreshToken: null, user: null, isBootstrapping: false }),
    }),
    {
      name: 'aguachiles-auth',
      partialize: (state) => ({ refreshToken: state.refreshToken, user: state.user }),
    },
  ),
);

export function useIsLoggedIn(): boolean {
  return useAuthStore((state) => Boolean(state.accessToken));
}

export function usePermission(code: PermissionCode): boolean {
  return useAuthStore((state) => state.user?.permissions.includes(code) ?? false);
}

// Referencia estable: un `?? []` dentro del selector crearía un arreglo nuevo
// en cada render, y Zustand (useSyncExternalStore) lo interpreta como que el
// snapshot cambió siempre — "Maximum update depth exceeded" en un loop
// infinito. Con esta constante de módulo, el fallback es la misma referencia
// entre renders mientras no haya usuario.
const EMPTY_PERMISSIONS: PermissionCode[] = [];

export function usePermissions(): PermissionCode[] {
  return useAuthStore((state) => state.user?.permissions ?? EMPTY_PERMISSIONS);
}
