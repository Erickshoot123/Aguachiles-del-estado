import { useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OperationalAnalytics } from '@aguachiles/shared';
import { AppShell } from '../components/AppShell';
import { authFetch } from '../lib/authFetch';
import { AnalyticsKpis } from '../features/analytics/AnalyticsKpis';
import { SalesMixTable } from '../features/analytics/SalesMixTable';
import { PaymentSummary } from '../features/analytics/PaymentSummary';
import { usePlateAvailability } from '../features/plates/hooks';
import '../features/analytics/analytics.css';

function startOfPeriod(today: string, period: string): string {
  if (!today || period === 'Hoy') return today;
  const date = new Date(today + 'T00:00:00Z');
  if (period === 'Esta semana') date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  if (period === 'Este mes') date.setUTCDate(1);
  return date.toISOString().slice(0, 10);
}
export function AnalyticsPage(): JSX.Element {
  const calendar = usePlateAvailability();
  const today = calendar.data?.date ?? '';
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [period, setPeriod] = useState('Hoy');
  const from = period === 'Personalizado' ? customFrom : startOfPeriod(today, period);
  const to = period === 'Personalizado' ? customTo : today;
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
    if (label === 'Personalizado' && period !== 'Personalizado') {
      setCustomFrom(from);
      setCustomTo(to);
    }
    setPeriod(label);
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
              : period === 'Personalizado'
                ? 'Selecciona un periodo válido'
                : 'Fecha de la sucursal'}
          </span>
          <span>Fechas de la sucursal · Importes en MXN</span>
          {period === 'Personalizado' ? (
            <>
              <label>
                Desde
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setCustomTo(event.target.value)}
                />
              </label>
            </>
          ) : null}
        </div>
        {period !== 'Personalizado' && !today ? (
          calendar.isError ? (
            <p className="analytics-status" role="alert">
              No se pudo cargar la fecha de la sucursal.
            </p>
          ) : (
            <p className="analytics-status" role="status">
              Cargando fecha de la sucursal…
            </p>
          )
        ) : !valid ? (
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
