import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Order, Ticket } from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';
import { printAtAgent } from './api';
import { usePrintSettingsStore } from './printSettingsStore';

interface KitchenJob { orderId: string; ticketNumber: string }
interface KitchenQueue {
  jobs: KitchenJob[];
  busy: string[];
  add: (job: KitchenJob) => void;
  remove: (orderId: string) => void;
}

export const useKitchenQueue = create<KitchenQueue>()(persist((set) => ({
  jobs: [], busy: [],
  add: (job) => set((state) => ({ jobs: state.jobs.some((item) => item.orderId === job.orderId)
    ? state.jobs : [...state.jobs, job] })),
  remove: (orderId) => set((state) => ({ jobs: state.jobs.filter((job) => job.orderId !== orderId) })),
}), { name: 'aguachiles-kitchen-queue', partialize: (state) => ({ jobs: state.jobs }) }));

/** Solo se reintenta por acción explícita: un fallo de respuesta puede ocurrir después de imprimir. */
export async function printKitchenJob(job: KitchenJob): Promise<void> {
  if (useKitchenQueue.getState().busy.includes(job.orderId)) return;
  useKitchenQueue.setState((state) => ({ busy: [...state.busy, job.orderId] }));
  try {
    const settings = usePrintSettingsStore.getState();
    const { ticket } = await authFetch<{ ticket: Ticket }>(`/api/orders/${job.orderId}/comanda`);
    if (settings.printMode === 'agente_local') {
      await printAtAgent({ ...ticket, format: settings.ticketFormat }, settings.printerId);
    } else {
      const target = settings.printMode === 'red'
        ? { mode: 'red', ...settings.networkPrinter }
        : { mode: 'otra_terminal', agentUrl: settings.otherTerminal.agentUrl };
      await authFetch(`/api/orders/${job.orderId}/comanda/print`, {
        method: 'POST', body: { target, printerId: settings.printerId ?? undefined, format: settings.ticketFormat },
      });
    }
    useKitchenQueue.getState().remove(job.orderId);
  } catch {
    // Conserva la tarea en la terminal. El pedido ya está creado; nunca se vuelve a crear por fallar impresión.
  } finally {
    useKitchenQueue.setState((state) => ({ busy: state.busy.filter((id) => id !== job.orderId) }));
  }
}

export async function printNewOrderKitchen(order: Order): Promise<void> {
  const job = { orderId: order.id, ticketNumber: order.ticketNumber };
  useKitchenQueue.getState().add(job);
  await printKitchenJob(job);
}
