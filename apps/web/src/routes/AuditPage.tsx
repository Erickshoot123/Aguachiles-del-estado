import type { AuditLogEntry } from '@aguachiles/shared';
import type { JSX } from 'react';
import { AppShell } from '../components/AppShell';
import { useAuditLogs } from '../features/audit/hooks';
import { formatCurrency } from '../features/orders/channelLabels';

const UI_TEXT = {
  title: 'Auditoría',
  loading: 'Cargando…',
  error: 'No se pudo cargar el historial de auditoría.',
  empty: 'Aún no hay movimientos registrados.',
  colDate: 'Fecha',
  colUser: 'Usuario',
  colAction: 'Acción',
  colDetails: 'Detalles',
  unknownUser: 'Sistema',
} as const;

const ACTION_LABELS: Record<string, string> = {
  price_change: 'Cambio de precio',
  cash_session_opened: 'Apertura de caja',
  cash_session_closed: 'Cierre de caja',
  refund_created: 'Reembolso',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function money(value: unknown): string {
  return typeof value === 'number' ? formatCurrency(value) : '—';
}

function summarize(log: AuditLogEntry): string {
  const oldValue = asRecord(log.oldValue);
  const newValue = asRecord(log.newValue);
  switch (log.action) {
    case 'price_change':
      return `${String(newValue.name ?? '')} · precio ${money(oldValue.price)} → ${money(newValue.price)}, costo ${money(oldValue.cost)} → ${money(newValue.cost)}`;
    case 'cash_session_opened':
      return `${String(newValue.cashRegisterName ?? '')} · fondo inicial ${money(newValue.openingAmount)}`;
    case 'cash_session_closed':
      return `Esperado ${money(oldValue.expectedClosingAmount)} · Contado ${money(newValue.actualClosingAmount)} · Diferencia ${money(newValue.difference)}`;
    case 'refund_created':
      return `Ticket ${String(newValue.ticketNumber ?? '')} · ${money(newValue.totalRefunded)} · ${String(newValue.reason ?? '')}`;
    default:
      return '';
  }
}

function AuditTable({ logs }: { logs: AuditLogEntry[] }): JSX.Element {
  if (logs.length === 0) {
    return <p className="text-sm text-muted">{UI_TEXT.empty}</p>;
  }
  return (
    <table className="w-full border-collapse overflow-hidden rounded-2xl bg-surface text-left text-sm">
      <thead>
        <tr className="border-b border-border text-[12px] uppercase tracking-wide text-muted-2">
          <th className="px-4 py-3">{UI_TEXT.colDate}</th>
          <th className="px-4 py-3">{UI_TEXT.colUser}</th>
          <th className="px-4 py-3">{UI_TEXT.colAction}</th>
          <th className="px-4 py-3">{UI_TEXT.colDetails}</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <tr key={log.id} className="border-b border-divider last:border-0">
            <td className="px-4 py-3 text-muted">{formatDateTime(log.createdAt)}</td>
            <td className="px-4 py-3 font-medium">{log.userName ?? UI_TEXT.unknownUser}</td>
            <td className="px-4 py-3">{ACTION_LABELS[log.action] ?? log.action}</td>
            <td className="px-4 py-3 text-muted">{summarize(log)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AuditPage(): JSX.Element {
  const auditLogsQuery = useAuditLogs();

  return (
    <AppShell>
      <header className="border-b border-border bg-surface px-7 py-[18px]">
        <h1 className="m-0 text-[23px] font-bold tracking-tight">{UI_TEXT.title}</h1>
      </header>

      <section className="flex-1 overflow-x-auto p-5">
        {auditLogsQuery.isLoading ? <p className="text-sm text-muted">{UI_TEXT.loading}</p> : null}
        {auditLogsQuery.isError ? <p className="text-sm text-red-600">{UI_TEXT.error}</p> : null}
        {auditLogsQuery.data ? <AuditTable logs={auditLogsQuery.data} /> : null}
      </section>
    </AppShell>
  );
}
