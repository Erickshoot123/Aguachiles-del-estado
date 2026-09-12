import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PrintTarget, Ticket } from '@aguachiles/shared';
import { useIsLoggedIn } from '../auth/authStore';
import { confirmPrinted, getReceipt, listAgentPrinters, printAtAgent, printViaBackend } from './api';

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

// Solo tiene sentido en modo "agente_local": una tablet sin Print Agent no
// debe intentar (y fallar) esta llamada a 127.0.0.1.
export function useAgentPrinters(enabled: boolean) {
  return useQuery({
    queryKey: ['agent-printers'] as const,
    queryFn: listAgentPrinters,
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function usePrintTicket(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ticket,
      printerId,
      target,
    }: {
      ticket: Ticket;
      printerId: string | null;
      target: PrintTarget;
    }) => {
      if (target.mode === 'agente_local') {
        await printAtAgent(ticket, printerId);
        await confirmPrinted(orderId);
        return;
      }
      await printViaBackend(orderId, target, printerId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: receiptQueryKey(orderId) });
    },
  });
}
