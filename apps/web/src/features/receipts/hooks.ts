import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Ticket } from '@aguachiles/shared';
import { useIsLoggedIn } from '../auth/authStore';
import { confirmPrinted, getReceipt, listAgentPrinters, printAtAgent } from './api';

function receiptQueryKey(orderId: string) {
  return ['receipt', orderId] as const;
}

export function useReceipt(orderId: string, enabled: boolean) {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: receiptQueryKey(orderId),
    queryFn: () => getReceipt(orderId),
    enabled: enabled && isLoggedIn,
  });
}

export function useAgentPrinters() {
  return useQuery({
    queryKey: ['agent-printers'] as const,
    queryFn: listAgentPrinters,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function usePrintTicket(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticket, printerId }: { ticket: Ticket; printerId: string | null }) => {
      await printAtAgent(ticket, printerId);
      await confirmPrinted(orderId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: receiptQueryKey(orderId) });
    },
  });
}
