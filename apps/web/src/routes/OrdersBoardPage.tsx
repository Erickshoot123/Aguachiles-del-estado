import type { Order } from '@aguachiles/shared';
import type { FormEvent, JSX } from 'react';
import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { BOARD_COLUMNS, getAdvanceActionLabel } from '../features/orders/boardColumns';
import { useAdvanceOrder, useOrderLookup, useOrders } from '../features/orders/hooks';
import { NewOrderModal } from '../features/orders/NewOrderModal';
import { OrderCard } from '../features/orders/OrderCard';
import { OrderDetailModal } from '../features/orders/OrderDetailModal';

const UI_TEXT = {
  title: 'Tablero de pedidos',
  subtitleLoading: 'Cargando pedidos…',
  subtitleError: 'No se pudieron cargar los pedidos.',
  newOrder: 'Nuevo pedido',
  emptyColumn: 'Sin pedidos',
  searchPlaceholder: 'Buscar pedido por folio…',
  searchAction: 'Buscar',
  searchNotFound: 'No se encontró ningún pedido con ese folio.',
} as const;

function summarize(orders: Order[]): string {
  const active = orders.length;
  const prep = orders.filter((order) => order.fulfillmentStatus === 'in_prep').length;
  const delivery = orders.filter((order) => order.fulfillmentStatus === 'in_delivery').length;
  return `${active} pedidos activos · ${prep} en cocina · ${delivery} en ruta`;
}

export function OrdersBoardPage(): JSX.Element {
  const ordersQuery = useOrders();
  const advanceOrder = useAdvanceOrder();
  const [isCreating, setIsCreating] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [submittedTicketNumber, setSubmittedTicketNumber] = useState('');
  const orderLookup = useOrderLookup(submittedTicketNumber, submittedTicketNumber !== '');

  const orders = ordersQuery.data ?? [];
  const boardDetailOrder = orders.find((order) => order.id === detailOrderId) ?? null;
  const searchedOrder = submittedTicketNumber !== '' ? (orderLookup.data ?? null) : null;
  const detailOrder = boardDetailOrder ?? searchedOrder;
  const detailAdvanceLabel = boardDetailOrder ? getAdvanceActionLabel(boardDetailOrder) : null;

  const closeDetail = (): void => {
    setDetailOrderId(null);
    setSubmittedTicketNumber('');
  };

  const handleSearch = (event: FormEvent): void => {
    event.preventDefault();
    const ticketNumber = searchTerm.trim();
    if (!ticketNumber) return;
    setDetailOrderId(null);
    setSubmittedTicketNumber(ticketNumber);
  };

  const subtitle = ordersQuery.isLoading
    ? UI_TEXT.subtitleLoading
    : ordersQuery.isError
      ? UI_TEXT.subtitleError
      : summarize(orders);

  return (
    <AppShell>
      <header className="flex flex-wrap items-center gap-6 border-b border-border bg-surface px-7 py-[18px]">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="m-0 text-[23px] font-bold tracking-tight">{UI_TEXT.title}</h1>
          <p className="m-0 text-[13px] text-muted">{subtitle}</p>
        </div>
        <form onSubmit={handleSearch} className="ml-auto flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={UI_TEXT.searchPlaceholder}
            className="h-11 rounded-lg border border-border px-3 text-[14px]"
          />
          <button
            type="submit"
            disabled={orderLookup.isFetching}
            className="h-11 rounded-lg border border-border px-4 text-[14px] hover:border-border-hover disabled:opacity-60"
          >
            {UI_TEXT.searchAction}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="h-11 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover"
        >
          {UI_TEXT.newOrder}
        </button>
      </header>
      {submittedTicketNumber !== '' && orderLookup.isError ? (
        <p className="px-7 pt-3 text-[13px] text-red-600">{UI_TEXT.searchNotFound}</p>
      ) : null}

      <section className="grid flex-1 grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {BOARD_COLUMNS.map((column) => {
          const columnOrders = orders.filter((order) => order.fulfillmentStatus === column.key);
          return (
            <div
              key={column.key}
              className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className="flex items-center gap-2.5 border-b border-divider px-3 py-3.5">
                <span className={`h-[22px] w-1 rounded ${column.accentClassName}`} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{column.title}</span>
                  <span className="font-mono text-[11px] text-muted-2">{column.subtitle}</span>
                </div>
                <span className="ml-auto rounded-full bg-bg px-2.5 py-1 font-mono text-[13px] font-semibold text-muted">
                  {columnOrders.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2.5 p-2.5">
                {columnOrders.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center text-[13px] text-muted-2">
                    {UI_TEXT.emptyColumn}
                  </div>
                ) : (
                  columnOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      advanceLabel={getAdvanceActionLabel(order) ?? column.advanceActionLabel}
                      onOpenDetail={(order) => {
                        setSubmittedTicketNumber('');
                        setDetailOrderId(order.id);
                      }}
                      onAdvance={(orderId) => advanceOrder.mutate(orderId)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </section>

      {isCreating ? <NewOrderModal onClose={() => setIsCreating(false)} /> : null}
      {detailOrder ? (
        <OrderDetailModal order={detailOrder} advanceLabel={detailAdvanceLabel} onClose={closeDetail} />
      ) : null}
    </AppShell>
  );
}
