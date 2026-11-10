import type { JSX, ReactNode } from 'react';
import { useEffect } from 'react';
import { refreshOnce } from '../../lib/authFetch';
import { useAuthStore } from './authStore';
import { InitialPasswordPage } from './InitialPasswordPage';

const UI_TEXT = {
  loading: 'Cargando…',
} as const;

interface AuthBootstrapProps {
  children: ReactNode;
}

export function AuthBootstrap({ children }: AuthBootstrapProps): JSX.Element {
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const needsPasswordChange = useAuthStore((state) =>
    Boolean(state.accessToken && state.user?.mustChangePassword),
  );
  const setBootstrapped = useAuthStore((state) => state.setBootstrapped);

  useEffect(() => {
    if (!isBootstrapping) return;
    if (!refreshToken) {
      setBootstrapped();
      return;
    }

    // refreshOnce ya deja isBootstrapping en false vía setSession/clearSession,
    // y deduplica llamadas concurrentes — importante porque el refresh token
    // rota en cada uso, así que dos llamadas con el mismo token chocarían.
    void refreshOnce();
  }, []);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-muted">
        {UI_TEXT.loading}
      </div>
    );
  }

  if (needsPasswordChange) return <InitialPasswordPage />;

  return <>{children}</>;
}
