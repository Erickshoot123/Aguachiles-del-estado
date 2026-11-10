import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserRequest, ResetPasswordRequest } from '@aguachiles/shared';
import { useIsLoggedIn } from '../auth/authStore';
import { createUser, listUsers, resetUserPassword, setUserStatus } from './api';

const USERS_QUERY_KEY = ['users'] as const;

function useRefreshUsers() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
  };
}

export function useUsers() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: listUsers,
    enabled: isLoggedIn,
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: ResetPasswordRequest }) =>
      resetUserPassword(userId, input),
    gcTime: 0,
    onSuccess: useRefreshUsers(),
  });
}

export function useCreateUser() {
  return useMutation({
    mutationFn: (input: CreateUserRequest) => createUser(input),
    gcTime: 0,
    onSuccess: useRefreshUsers(),
  });
}

export function useSetUserStatus() {
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      setUserStatus(userId, isActive),
    onSuccess: useRefreshUsers(),
  });
}
