import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ApiError } from '../../lib/apiClient';
import { useIsLoggedIn } from '../auth/authStore';
import { createOrder } from './api';
import { ORDERS_QUERY_KEY } from './hooks';
import { type QueuedOrder, useOfflineQueueStore } from './offlineQueue';

const RETRY_INTERVAL_MS = 30_000;

// Deduplica reintentos concurrentes (ej. React StrictMode montando el efecto
// dos veces, o el intervalo disparando mientras un flush anterior sigue en
// curso): sin esto, dos llamadas simultáneas podrían leer el mismo pedido en
// cola antes de que ninguna lo saque, y crearlo dos veces.
let flushInFlight: Promise<void> | null = null;

async function flushQueueOnce(queue: QueuedOrder[], onOrderSynced: () => void): Promise<void> {
  const { dequeue, markFailed } = useOfflineQueueStore.getState();

  for (const item of queue) {
    if (item.lastError) continue;

    try {
      await createOrder(item.input);
      dequeue(item.id);
      onOrderSynced();
    } catch (error) {
      if (!(error instanceof ApiError)) {
        return;
      }
      markFailed(item.id, error.message);
    }
  }
}

function flushQueue(queue: QueuedOrder[], onOrderSynced: () => void): void {
  flushInFlight ??= flushQueueOnce(queue, onOrderSynced).finally(() => {
    flushInFlight = null;
  });
}

/**
 * Reintenta en segundo plano los pedidos que quedaron en cola porque el
 * servidor local no respondió al crearlos (Fase 3: resiliencia de red,
 * alcance limitado a "crear pedido" — no cubre otras operaciones).
 */
export function useOfflineQueueSync(): void {
  const isLoggedIn = useIsLoggedIn();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoggedIn) return;

    const trigger = (): void => {
      flushQueue(useOfflineQueueStore.getState().queue, () => {
        void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
      });
    };

    trigger();
    window.addEventListener('online', trigger);
    const interval = setInterval(trigger, RETRY_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', trigger);
      clearInterval(interval);
    };
  }, [isLoggedIn, queryClient]);
}
