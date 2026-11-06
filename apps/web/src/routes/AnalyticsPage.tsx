import { useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OperationalAnalytics } from '@aguachiles/shared';
import { AppShell } from '../components/AppShell';
import { authFetch } from '../lib/authFetch';
import { AnalyticsKpis } from '../features/analytics/AnalyticsKpis';
import { SalesMixTable } from '../features/analytics/SalesMixTable';
import { PaymentSummary } from '../features/analytics/PaymentSummary';
import '../features/analytics/analytics.css';

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function AnalyticsPage(): JSX.Element {
  const [from, setFrom] = useState(localDate(new Date()));
  const [to, setTo] = useState(localDate(new Date()));
  const [period, setPeriod] = useState('Hoy');
  const valid = from !== '' && to !== '' && from <= to;
  const query = useQuery({
    queryKey: ['operations', from, to],
    enabled: valid,
    queryFn: () => {
      const params = new URLSearchParams({ from, to });
      return authFetch<OperationalAnalytics>(`/api/analytics/operations?${params}`);
    },
  });
  const choose = (label: string): void => {
    setPeriod(label);
    if (label === 'Personalizado') return;
    const now = new Date();
    const start = new Date(now);
    if (label === 'Esta semana') start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    if (label === 'Este mes') start.setDate(1);
    setFrom(localDate(start));
    setTo(localDate(now));
  };
  const data = valid && !query.isError ? query.data : undefined;
  const displayDay = (value: string): string =>
    new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(value + 'T12:00:00'),
    );
  return (
    <AppShell>
      <div className="analytics-dashboard">
        <header className="analytics-topbar">
          <div>
            <p className="analytics-overline">Resumen del negocio</p>
            <h1>Analíticas operativas</h1>
          </div>
          <div className="analytics-period-buttons" role="group" aria-label="Periodo de analíticas">
            {['Hoy', 'Esta semana', 'Este mes', 'Personalizado'].map((label) => (
              <button
                key={label}
                type="button"
                aria-pressed={period === label}
                onClick={() => choose(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>
        <div className="analytics-range">
          <span>
            {valid
              ? from === to
                ? displayDay(from)
                : `${displayDay(from)} — ${displayDay(to)}`
              : 'Selecciona un periodo válido'}
          </span>
          <span>Fechas de la sucursal · Importes en MXN</span>
          {period === 'Personalizado' ? (
            <>
              <label>
                Desde
                <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label>
                Hasta
                <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
            </>
          ) : null}
        </div>
        {!valid ? (
          <p className="analytics-status" role="alert">
            Revisa el rango de fechas.
          </p>
        ) : query.isError ? (
          <p className="analytics-status" role="alert">
            No se pudo cargar la analítica. Vuelve a seleccionar el periodo para intentarlo.
          </p>
        ) : query.isLoading ? (
          <p className="analytics-status" role="status">
            Cargando cifras del periodo…
          </p>
        ) : null}
        {data ? (
          <>
            <AnalyticsKpis data={data} />
            <div className="analytics-detail-grid">
              <SalesMixTable mix={data.mix} />
              <PaymentSummary data={data} />
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
