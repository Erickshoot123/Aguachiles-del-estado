import type { JSX } from 'react';
import { useOfflineQueueStore } from './offlineQueue';

const UI_TEXT = {
  pending: (count: number) => `${count} pedido(s) guardado(s) localmente, sincronizando…`,
  failedPrefix: 'No se pudo sincronizar un pedido',
  discard: 'Descartar',
} as const;

export function OfflineQueueBanner(): JSX.Element | null {
  const queue = useOfflineQueueStore((state) => state.queue);
  const dequeue = useOfflineQueueStore((state) => state.dequeue);

  if (queue.length === 0) {
    return null;
  }

  const pending = queue.filter((item) => !item.lastError);
  const failed = queue.filter((item) => item.lastError);

  return (
    <div className="flex flex-col gap-1 border-b border-amber-200 bg-amber-50 px-5 py-2 text-[13px] text-amber-800">
      {pending.length > 0 ? <span>{UI_TEXT.pending(pending.length)}</span> : null}
      {failed.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <span>
            {UI_TEXT.failedPrefix}: {item.lastError}
          </span>
          <button
            type="button"
            onClick={() => dequeue(item.id)}
            className="font-semibold underline hover:no-underline"
          >
            {UI_TEXT.discard}
          </button>
        </div>
      ))}
    </div>
  );
}
