import type { OperationalAnalytics } from '@aguachiles/shared';
import type { JSX } from 'react';
import { formatCurrency } from '../orders/channelLabels';

export function AnalyticsKpis({ data }: { data: OperationalAnalytics }): JSX.Element {
  return (
    <section className="analytics-kpis" aria-label="Indicadores del periodo">
      <article className="analytics-kpi analytics-kpi-primary">
        <span className="analytics-eyebrow">Ventas de comida</span>
        <strong className="analytics-sales-value">{formatCurrency(data.foodSales)}</strong>
        <span className="analytics-kpi-note">Venta neta de comida · sin descontar mandaditos</span>
      </article>
      <article className="analytics-kpi">
        <span className="analytics-eyebrow">Ticket promedio de comida</span>
        <strong>{formatCurrency(data.averageTicket)}</strong>
        <span className="analytics-kpi-note">Por pedido cerrado</span>
      </article>
      <article className="analytics-kpi">
        <span className="analytics-eyebrow">Pedidos cerrados</span>
        <strong>{data.orders.toLocaleString('es-MX')}</strong>
        <span className="analytics-kpi-note">Órdenes cobradas en el periodo</span>
      </article>
    </section>
  );
}
