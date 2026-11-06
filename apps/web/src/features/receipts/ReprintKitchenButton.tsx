import { useState, type JSX } from 'react';
import type { Order } from '@aguachiles/shared';
import { printNewOrderKitchen, useKitchenQueue } from './kitchenPrinting';

export function ReprintKitchenButton({ order }: { order: Order }): JSX.Element {
  const busy = useKitchenQueue((state) => state.busy.includes(order.id));
  const [message, setMessage] = useState('');
  const reprint = async (): Promise<void> => {
    if (useKitchenQueue.getState().busy.includes(order.id)) return;
    setMessage('');
    await printNewOrderKitchen(order, true);
    setMessage(useKitchenQueue.getState().jobs.some((job) => job.orderId === order.id)
      ? 'Impresión sin confirmar. Revisa si salió antes de volver a imprimir.' : 'Comanda enviada a la impresora.');
  };
  return <div className="w-full">
    <button type="button" disabled={busy} onClick={() => { void reprint(); }}
      className="h-11 rounded-lg border border-accent px-4 text-sm font-semibold text-accent-hover disabled:opacity-50">
      {busy ? 'Imprimiendo…' : 'Reimprimir comanda'}
    </button>
    {message ? <p role="status" className="mt-1 text-sm">{message}</p> : null}
  </div>;
}
