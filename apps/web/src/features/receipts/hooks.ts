import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Ticket } from '@aguachiles/shared';
import { useAuthStore } from '../auth/authStore';
import { confirmPrinted, getReceipt, printAtAgent } from './api';

function receiptQueryKey(orderId: string) {
  return ['receipt', orderId] as const;
}

export function useReceipt(orderId: string, enabled: boolean) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: receiptQueryKey(orderId),
    queryFn: () => getReceipt(accessToken as string, orderId),
    enabled: enabled && Boolean(accessToken),
  });
}

export function usePrintTicket(orderId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticket: Ticket) => {
      await printAtAgent(ticket);
      await confirmPrinted(accessToken as string, orderId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: receiptQueryKey(orderId) });
    },
  });
}
