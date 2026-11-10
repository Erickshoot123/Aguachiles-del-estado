import { useState, type JSX } from 'react';
import type { Order } from '@aguachiles/shared';
import { printNewOrderKitchen, useKitchenQueue } from './kitchenPrinting';
import { KitchenPrintModal } from './KitchenPrintModal';

export function ReprintKitchenButton({ order }: { order: Order }): JSX.Element {
  const busy = useKitchenQueue((state) => state.busy.includes(order.id));
  const [message, setMessage] = useState('');
  const [choosePrinter, setChoosePrinter] = useState(false);
  const reprint = async (): Promise<void> => {
    if (useKitchenQueue.getState().busy.includes(order.id)) return;
    setMessage('');
    await printNewOrderKitchen(order, true);
    setMessage(
      useKitchenQueue.getState().jobs.some((job) => job.orderId === order.id)
        ? 'Impresión sin confirmar. Revisa si salió antes de volver a imprimir.'
        : 'Comanda enviada a la impresora.',
    );
  };
  return (
    <div className="flex w-full flex-wrap gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void reprint();
        }}
        className="h-11 rounded-lg border border-accent px-4 text-sm font-semibold text-accent-hover disabled:opacity-50"
      >
        {busy ? 'Imprimiendo…' : 'Reimprimir comanda'}
      </button>
      <button
        type="button"
        onClick={() => setChoosePrinter(true)}
        className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-text hover:bg-accent-soft"
      >
        Comanda en otra impresora…
      </button>
      {message ? (
        <p role="status" className="w-full text-sm">
          {message}
        </p>
      ) : null}
      {choosePrinter ? (
        <KitchenPrintModal orderId={order.id} onClose={() => setChoosePrinter(false)} />
      ) : null}
    </div>
  );
}
