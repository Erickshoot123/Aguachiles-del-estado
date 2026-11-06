import type { MandaditoExpense } from '@aguachiles/shared';
import { useQuery } from '@tanstack/react-query';
import { type JSX } from 'react';
import { authFetch } from '../../lib/authFetch';
import { formatCurrency } from '../orders/channelLabels';
import { MandaditoButton } from './MandaditoButton';

export function OrderMandaditos({
  saleId,
  ticketNumber,
}: {
  saleId: string;
  ticketNumber: string;
}): JSX.Element {
  const query = useQuery({
    queryKey: ['mandaditos', saleId],
    queryFn: () => authFetch<MandaditoExpense[]>(`/api/orders/${saleId}/mandaditos`),
  });
  return (
    <section className="rounded-lg border border-border p-3">
      <h3 className="mb-2 text-sm font-semibold">Gastos internos de mandaditos</h3>
      {query.isLoading ? <p className="text-sm">Cargando gastos…</p> : null}
      {query.isError ? (
        <p role="alert" className="text-sm text-red-700">
          No se pudieron cargar los gastos.
        </p>
      ) : null}
      {(query.data ?? []).map((expense) => (
        <p key={expense.id} className="mb-1 text-sm">
          {formatCurrency(expense.amount)} · {expense.paymentMethodName} ·{' '}
          {new Date(expense.createdAt).toLocaleString('es-MX')}
          {expense.description ? ` · ${expense.description}` : ''}
        </p>
      ))}
      {query.data?.length ? (
        <p className="mb-2 text-sm font-semibold">
          Total pagado:{' '}
          {formatCurrency(query.data.reduce((sum, expense) => sum + expense.amount, 0))}
        </p>
      ) : null}
      <MandaditoButton saleId={saleId} ticketNumber={ticketNumber} />
    </section>
  );
}
