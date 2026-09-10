import type { PermissionCode } from '@aguachiles/shared';
import type { JSX, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore, usePermissions } from './authStore';

interface ProtectedRouteProps {
  children: ReactNode;
  permission?: PermissionCode;
}

export function ProtectedRoute({ children, permission }: ProtectedRouteProps): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const permissions = usePermissions();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  if (permission && !permissions.includes(permission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
