import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ResetPasswordRequest } from '@aguachiles/shared';
import { useIsLoggedIn } from '../auth/authStore';
import { listUsers, resetUserPassword } from './api';

const USERS_QUERY_KEY = ['users'] as const;

export function useUsers() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: listUsers,
    enabled: isLoggedIn,
  });
}

export function useResetUserPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: ResetPasswordRequest }) =>
      resetUserPassword(userId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}
