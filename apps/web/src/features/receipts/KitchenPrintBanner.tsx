import type { JSX } from 'react';
import { printKitchenJob, useKitchenQueue } from './kitchenPrinting';

export function KitchenPrintBanner(): JSX.Element | null {
  const { jobs, busy, remove } = useKitchenQueue();
  if (!jobs.length) return null;
  return <div className="border-b border-border bg-accent-soft p-3 text-sm" role="status">
    {jobs.map((job) => <div key={job.orderId} className="flex flex-wrap items-center gap-3 py-1">
      <span>{busy.includes(job.orderId) ? `Enviando comanda ${job.ticketNumber}…`
        : `Pedido ${job.ticketNumber} creado. Impresión sin confirmar; revisa si salió antes de reimprimir.`}</span>
      <button type="button" disabled={busy.includes(job.orderId)} onClick={() => { void printKitchenJob(job); }}
        className="rounded border border-border px-3 py-1 disabled:opacity-50">Reimprimir comanda</button>
      <button type="button" disabled={busy.includes(job.orderId)} onClick={() => remove(job.orderId)}
        className="rounded border border-border px-3 py-1 disabled:opacity-50">Ya salió</button>
    </div>)}
  </div>;
}
