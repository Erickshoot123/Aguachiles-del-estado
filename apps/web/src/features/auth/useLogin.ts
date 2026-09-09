import { useMutation } from '@tanstack/react-query';
import type { LoginRequest, LoginResponse } from '@aguachiles/shared';
import { login } from './api';
import { useAuthStore } from './authStore';

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: login,
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
    },
  });
}
