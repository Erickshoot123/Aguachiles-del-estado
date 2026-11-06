import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdjustPlates, InitializePlates, PlateAvailability } from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';
import { useIsLoggedIn } from '../auth/authStore';

export const PLATES_QUERY_KEY = ['plates-today'] as const;
export function usePlateAvailability() {
  const loggedIn = useIsLoggedIn();
  return useQuery({ queryKey: PLATES_QUERY_KEY, enabled: loggedIn,
    queryFn: () => authFetch<PlateAvailability>('/api/plates/today'), refetchInterval: 5000 });
}
export function useSavePlates(initial: boolean) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: InitializePlates | AdjustPlates) =>
    authFetch<PlateAvailability>('/api/plates/today', { method: initial ? 'POST' : 'PATCH', body: input }),
  onSettled: () => { void queryClient.invalidateQueries({ queryKey: PLATES_QUERY_KEY }); } });
}
