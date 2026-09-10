import type { AnalyticsTopProduct, AnalyticsTrendPoint } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { useAnalyticsDashboard } from '../features/analytics/hooks';
import { formatCurrency } from '../features/orders/channelLabels';
import * as dateRanges from '../features/reports/dateRanges';
import type { DateRange } from '../features/reports/dateRanges';

const UI_TEXT = {
  title: 'Analítica',
  today: 'Hoy',
  last7Days: 'Últimos 7 días',
  last30Days: 'Últimos 30 días',
  thisMonth: 'Este mes',
  revenue: 'Ingresos netos',
  cost: 'Costo de venta',
  grossMargin: 'Margen bruto',
  loading: 'Cargando…',
  error: 'No se pudo cargar la analítica.',
  trendTitle: 'Tendencia de ventas',
  emptyTrend: 'Sin ventas en este periodo.',
  topProductsTitle: 'Productos más vendidos',
  emptyTopProducts: 'Sin ventas en este periodo.',
  colProduct: 'Producto',
  colQuantity: 'Cantidad',
  colRevenue: 'Ingresos',
  colMargin: 'Margen',
} as const;

const RANGE_OPTIONS: { label: string; getRange: () => DateRange }[] = [
  { label: UI_TEXT.today, getRange: dateRanges.today },
  { label: UI_TEXT.last7Days, getRange: () => dateRanges.lastNDays(7) },
  { label: UI_TEXT.last30Days, getRange: () => dateRanges.lastNDays(30) },
  { label: UI_TEXT.thisMonth, getRange: dateRanges.thisMonth },
];

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: 'accent' }): JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={`font-mono text-[22px] font-semibold ${tone === 'accent' ? 'text-accent-hover' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function TrendChart({ points }: { points: AnalyticsTrendPoint[] }): JSX.Element {
  if (points.length === 0) {
    return <p className="text-sm text-muted">{UI_TEXT.emptyTrend}</p>;
  }
  const maxTotal = Math.max(...points.map((point) => point.total), 1);
  const barWidth = 100 / points.length;

  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-32 w-full">
      {points.map((point, index) => {
        const height = (point.total / maxTotal) * 36;
        return (
          <rect
            key={point.date}
            x={index * barWidth + barWidth * 0.15}
            y={40 - height}
            width={barWidth * 0.7}
            height={Math.max(height, 0.5)}
            className="fill-accent"
          >
            <title>
              {formatShortDate(point.date)}: {formatCurrency(point.total)}
            </title>
          </rect>
        );
      })}
    </svg>
  );
}

function TopProductsTable({ products }: { products: AnalyticsTopProduct[] }): JSX.Element {
  if (products.length === 0) {
    return <p className="text-sm text-muted">{UI_TEXT.emptyTopProducts}</p>;
  }
  return (
    <table className="w-full border-collapse overflow-hidden rounded-2xl bg-surface text-left text-sm">
      <thead>
        <tr className="border-b border-border text-[12px] uppercase tracking-wide text-muted-2">
          <th className="px-4 py-3">{UI_TEXT.colProduct}</th>
          <th className="px-4 py-3">{UI_TEXT.colQuantity}</th>
          <th className="px-4 py-3">{UI_TEXT.colRevenue}</th>
          <th className="px-4 py-3">{UI_TEXT.colMargin}</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.productId} className="border-b border-divider last:border-0">
            <td className="px-4 py-3 font-medium">{product.productName}</td>
            <td className="px-4 py-3 font-mono">{product.quantity}</td>
            <td className="px-4 py-3 font-mono">{formatCurrency(product.revenue)}</td>
            <td className="px-4 py-3 font-mono text-muted">
              {formatCurrency(product.margin)} ({product.marginPercent.toFixed(0)}%)
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AnalyticsPage(): JSX.Element {
  const [range, setRange] = useState<DateRange>(dateRanges.today());
  const [selectedLabel, setSelectedLabel] = useState<string>(UI_TEXT.today);
  const dashboardQuery = useAnalyticsDashboard(range.from.toISOString(), range.to.toISOString());
  const dashboard = dashboardQuery.data;

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

      <section className="flex-1 overflow-x-auto p-5">
        {dashboardQuery.isLoading ? <p className="text-sm text-muted">{UI_TEXT.loading}</p> : null}
        {dashboardQuery.isError ? <p className="text-sm text-red-600">{UI_TEXT.error}</p> : null}

        {dashboard ? (
          <>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryCard label={UI_TEXT.revenue} value={formatCurrency(dashboard.totalRevenue)} />
              <SummaryCard label={UI_TEXT.cost} value={formatCurrency(dashboard.totalCost)} />
              <SummaryCard
                label={UI_TEXT.grossMargin}
                value={`${formatCurrency(dashboard.grossMargin)} (${dashboard.grossMarginPercent.toFixed(1)}%)`}
                tone="accent"
              />
            </div>

            <h2 className="m-0 mb-3 text-[15px] font-semibold">{UI_TEXT.trendTitle}</h2>
            <div className="mb-8 rounded-2xl border border-border bg-surface p-4">
              <TrendChart points={dashboard.dailyTrend} />
            </div>

            <h2 className="m-0 mb-3 text-[15px] font-semibold">{UI_TEXT.topProductsTitle}</h2>
            <TopProductsTable products={dashboard.topProducts} />
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
