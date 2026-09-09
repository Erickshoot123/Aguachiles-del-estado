import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@aguachiles/shared';

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
