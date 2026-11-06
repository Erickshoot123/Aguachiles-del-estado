import type { BranchSummary } from '@aguachiles/shared';

export const formatMoney = (value: string) => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN',
}).format(Number(value));

function connectionLabel(branch: BranchSummary): string {
  if (!branch.isActive) return 'Instalación desactivada';
  if (!branch.lastSeenAt) return 'Sin datos recibidos';
  if (Date.now() - Date.parse(branch.lastSeenAt) > 60000) return 'Sin actualización reciente';
  if (branch.pendingCount) return `Actualizando · ${branch.pendingCount} pendientes`;
  return 'Actualizada';
}

export function BranchCard({ branch }: { branch: BranchSummary }) {
  const metrics = [
    ['Cobros', formatMoney(branch.grossSales)], ['Devoluciones', formatMoney(branch.refunds)],
    ['Tickets cobrados', String(branch.tickets)], ['Ticket promedio bruto', formatMoney(branch.averageTicket)],
    ['Cajas abiertas', String(branch.openSessions)],
  ];
  return <article className="rounded-2xl border border-border bg-surface p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-bold">{branch.name}</h2>
      <span className="rounded-full bg-bg px-3 py-1 text-xs">{connectionLabel(branch)}</span>
    </div>
    <p className="mt-3 text-sm text-muted">Ingresos netos del periodo</p>
    <p className="font-mono text-3xl font-semibold">{formatMoney(branch.netSales)}</p>
    <dl className="my-4 grid grid-cols-2 gap-3 text-sm">
      {metrics.map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="font-mono">{value}</dd></div>)}
    </dl>
    <p className="mb-2 text-sm font-semibold">Cobros por método (antes de devoluciones)</p>
    <div className="grid grid-cols-2 gap-2 text-sm">
      <span>Efectivo: {formatMoney(branch.payments.cash)}</span><span>Tarjeta: {formatMoney(branch.payments.card)}</span>
      <span>Transferencia: {formatMoney(branch.payments.transfer)}</span><span>Otros: {formatMoney(branch.payments.other)}</span>
    </div>
    <p className="mt-4 text-xs text-muted">{branch.timeZone} · Última recepción: {branch.lastSeenAt
      ? new Date(branch.lastSeenAt).toLocaleString('es-MX') : 'Nunca'}</p>
    {!!branch.recentClosings.length && <details className="mt-4 border-t border-border pt-3 text-sm">
      <summary className="cursor-pointer font-semibold">Últimos 5 cierres (todos los periodos)</summary>
      {branch.recentClosings.map((closing) => <div key={closing.id} className="mt-3 border-b border-border pb-2">
        <p>{closing.closedAt ? new Date(closing.closedAt).toLocaleString('es-MX', { timeZone: branch.timeZone }) : 'Fecha no disponible'}</p>
        <p>Esperado: {formatMoney(closing.expectedAmount ?? '0')} · Contado: {formatMoney(closing.actualAmount ?? '0')}</p>
        <p>Diferencia: {formatMoney(closing.difference ?? '0')}</p>
      </div>)}
    </details>}
  </article>;
}
