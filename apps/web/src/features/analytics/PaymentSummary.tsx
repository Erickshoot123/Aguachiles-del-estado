import type { OperationalAnalytics } from '@aguachiles/shared';
import type { JSX } from 'react';
import { formatCurrency } from '../orders/channelLabels';

export function PaymentSummary({ data }: { data: OperationalAnalytics }): JSX.Element {
  const received = data.payments.reduce((sum, row) => sum + row.amount, 0);
  const refunds = data.payments.reduce((sum, row) => sum + row.refunds, 0);
  return (
    <div className="analytics-payment-column">
      <section className="analytics-panel" aria-labelledby="payments-title">
        <div className="analytics-panel-heading">
          <div>
            <h2 id="payments-title">Corte por método de pago</h2>
            <p>Cobros íntegros de los clientes</p>
          </div>
          <span className="analytics-tag">Ingresos</span>
        </div>
        <div className="analytics-table-scroll">
          <table className="analytics-table" aria-label="Ingresos por método de pago">
            <thead>
              <tr>
                <th scope="col">Método</th>
                <th scope="col" className="analytics-number">
                  Cobrado
                </th>
                <th scope="col" className="analytics-number">
                  Transacciones
                </th>
              </tr>
            </thead>
            <tbody>
              {data.payments.length ? (
                data.payments.map((row) => (
                  <tr key={row.name} className={row.amount === 0 ? 'analytics-empty-row' : ''}>
                    <th scope="row">{row.name}</th>
                    <td className="analytics-number analytics-collected">
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="analytics-number">{row.transactions.toLocaleString('es-MX')}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="analytics-no-data">
                    Sin cobros en este periodo
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total cobrado</th>
                <td className="analytics-number">{formatCurrency(received)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="analytics-refunds">
          <span>Devoluciones del periodo</span>
          <strong>{formatCurrency(refunds)}</strong>
        </div>
        <p className="analytics-panel-footnote">
          Los cobros se muestran completos. Un pago dividido cuenta en cada método utilizado.
        </p>
      </section>
      <section className="analytics-expenses" aria-labelledby="expenses-title">
        <div className="analytics-expense-heading">
          <h2 id="expenses-title">Gastos de mandaditos</h2>
          <span className="analytics-expense-tag">Egresos del negocio</span>
        </div>
        <strong className="analytics-expense-value">{formatCurrency(data.mandaditoTotal)}</strong>
        <div className="analytics-expense-breakdown">
          <div>
            <span>Efectivo de caja</span>
            <strong>{formatCurrency(data.mandaditoCashTotal)}</strong>
          </div>
          <div>
            <span>Transferencias</span>
            <strong>{formatCurrency(data.mandaditoTransferTotal)}</strong>
          </div>
        </div>
        <p>
          Registrados cuando se paga al repartidor. Se muestran por separado y no cambian las ventas
          de comida ni el ticket promedio.
        </p>
      </section>
    </div>
  );
}
