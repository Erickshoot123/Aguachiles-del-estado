import type { JSX } from 'react';
import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { CHANNEL_LABELS, formatCurrency } from '../features/orders/channelLabels';
import * as dateRanges from '../features/reports/dateRanges';
import type { DateRange } from '../features/reports/dateRanges';
import { useCashSessionHistory, useSalesReport } from '../features/reports/hooks';
import { ReportTable } from '../features/reports/ReportTable';

const UI_TEXT = {
  title: 'Reportes',
  today: 'Hoy',
  yesterday: 'Ayer',
  last7Days: 'Últimos 7 días',
  thisMonth: 'Este mes',
  totalSales: 'Total vendido',
  totalTickets: 'Tickets',
  averageTicket: 'Ticket promedio',
  byProduct: 'Ventas por producto',
  byCashier: 'Ventas por cajero',
  byChannel: 'Ventas por canal',
  byPaymentMethod: 'Ventas por método de pago',
  cashHistory: 'Historial de cortes de caja',
  loading: 'Cargando…',
  error: 'No se pudo cargar el reporte.',
  emptyProduct: 'Sin ventas en este periodo.',
  emptyCashier: 'Sin ventas en este periodo.',
  emptyChannel: 'Sin ventas en este periodo.',
  emptyPaymentMethod: 'Sin cobros en este periodo.',
  emptyHistory: 'Aún no hay cortes de caja.',
} as const;

const RANGE_OPTIONS: { label: string; getRange: () => DateRange }[] = [
  { label: UI_TEXT.today, getRange: dateRanges.today },
  { label: UI_TEXT.yesterday, getRange: dateRanges.yesterday },
  { label: UI_TEXT.last7Days, getRange: () => dateRanges.lastNDays(7) },
  { label: UI_TEXT.thisMonth, getRange: dateRanges.thisMonth },
];

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function SummaryCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="font-mono text-[22px] font-semibold">{value}</div>
    </div>
  );
}

export function ReportsPage(): JSX.Element {
  const [range, setRange] = useState<DateRange>(dateRanges.today());
  const [selectedLabel, setSelectedLabel] = useState<string>(UI_TEXT.today);

  const salesReportQuery = useSalesReport(range.from.toISOString(), range.to.toISOString());
  const cashHistoryQuery = useCashSessionHistory();
  const report = salesReportQuery.data;

  const averageTicket =
    report && report.totalTickets > 0 ? report.totalSales / report.totalTickets : 0;

  return (
    <AppShell>
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-7 py-[18px]">
        <h1 className="m-0 text-[23px] font-bold tracking-tight">{UI_TEXT.title}</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                setRange(option.getRange());
                setSelectedLabel(option.label);
              }}
              className={
                selectedLabel === option.label
                  ? 'h-10 rounded-lg bg-accent px-3 text-[13px] font-semibold text-white'
                  : 'h-10 rounded-lg border border-border px-3 text-[13px] hover:border-border-hover'
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <section className="flex flex-col gap-5 p-5">
        {salesReportQuery.isLoading ? (
          <p className="text-sm text-muted">{UI_TEXT.loading}</p>
        ) : null}
        {salesReportQuery.isError ? <p className="text-sm text-red-600">{UI_TEXT.error}</p> : null}

        {report ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryCard label={UI_TEXT.totalSales} value={formatCurrency(report.totalSales)} />
              <SummaryCard label={UI_TEXT.totalTickets} value={String(report.totalTickets)} />
              <SummaryCard label={UI_TEXT.averageTicket} value={formatCurrency(averageTicket)} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ReportTable
                title={UI_TEXT.byProduct}
                columns={['Producto', 'Cantidad', 'Total']}
                rows={report.byProduct.map((row) => [
                  row.productName,
                  row.quantity,
                  formatCurrency(row.total),
                ])}
                emptyText={UI_TEXT.emptyProduct}
              />
              <ReportTable
                title={UI_TEXT.byCashier}
                columns={['Cajero', 'Tickets', 'Total']}
                rows={report.byCashier.map((row) => [
                  row.userName,
                  row.count,
                  formatCurrency(row.total),
                ])}
                emptyText={UI_TEXT.emptyCashier}
              />
              <ReportTable
                title={UI_TEXT.byChannel}
                columns={['Canal', 'Tickets', 'Total']}
                rows={report.byChannel.map((row) => [
                  CHANNEL_LABELS[row.channel],
                  row.count,
                  formatCurrency(row.total),
                ])}
                emptyText={UI_TEXT.emptyChannel}
              />
              <ReportTable
                title={UI_TEXT.byPaymentMethod}
                columns={['Método', 'Total']}
                rows={report.byPaymentMethod.map((row) => [
                  row.paymentMethodName,
                  formatCurrency(row.total),
                ])}
                emptyText={UI_TEXT.emptyPaymentMethod}
              />
            </div>
          </>
        ) : null}

        <ReportTable
          title={UI_TEXT.cashHistory}
          columns={['Caja', 'Abrió', 'Cerró', 'Fondo', 'Esperado', 'Contado', 'Diferencia']}
          rows={(cashHistoryQuery.data ?? []).map((session) => [
            session.cashRegisterName,
            `${session.openedByName} · ${formatDateTime(session.openedAt)}`,
            session.closedByName
              ? `${session.closedByName} · ${formatDateTime(session.closedAt)}`
              : '—',
            formatCurrency(session.openingAmount),
            session.expectedClosingAmount !== null
              ? formatCurrency(session.expectedClosingAmount)
              : '—',
            session.actualClosingAmount !== null
              ? formatCurrency(session.actualClosingAmount)
              : '—',
            session.difference !== null ? formatCurrency(session.difference) : '—',
          ])}
          emptyText={UI_TEXT.emptyHistory}
        />
      </section>
    </AppShell>
  );
}
