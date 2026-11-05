import type { CashSession } from '@aguachiles/shared';
import type { JSX } from 'react';
import { formatCurrency } from '../orders/channelLabels';

export function MandaditoSummary({ session }: { session: CashSession }): JSX.Element {
  return (
    <div className="my-3 rounded-lg bg-bg p-3 text-sm">
      <p className="font-semibold">
        Gastos de mandaditos: {formatCurrency(session.mandaditoTotal ?? 0)}
      </p>
      <p>Efectivo de caja: {formatCurrency(session.mandaditoCashTotal ?? 0)}</p>
      <p>Transferencias: {formatCurrency(session.mandaditoTransferTotal ?? 0)}</p>
      <p className="text-xs text-muted">
        El efectivo esperado ya descuenta los mandaditos pagados desde caja.
      </p>
    </div>
  );
}
