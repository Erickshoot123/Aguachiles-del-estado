import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CreateOrderRequest } from '@aguachiles/shared';

export interface QueuedOrder {
  id: string;
  input: CreateOrderRequest;
  queuedAt: string;
  lastError: string | null;
}

interface OfflineQueueState {
  queue: QueuedOrder[];
  enqueue: (input: CreateOrderRequest) => void;
  dequeue: (id: string) => void;
  markFailed: (id: string, message: string) => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set) => ({
      queue: [],
      enqueue: (input) =>
        set((state) => ({
          queue: [
            ...state.queue,
            { id: crypto.randomUUID(), input, queuedAt: new Date().toISOString(), lastError: null },
          ],
        })),
      dequeue: (id) => set((state) => ({ queue: state.queue.filter((item) => item.id !== id) })),
      markFailed: (id, message) =>
        set((state) => ({
          queue: state.queue.map((item) => (item.id === id ? { ...item, lastError: message } : item)),
        })),
    }),
    { name: 'aguachiles-offline-order-queue' },
  ),
);
