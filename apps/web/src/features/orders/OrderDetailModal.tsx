import type { Order } from '@aguachiles/shared';
import type { JSX } from 'react';
import { CHANNEL_LABELS, formatCurrency, formatElapsedMinutes } from './channelLabels';
import { useAdvanceOrder, useCancelOrder, useChargeOrder } from './hooks';

const UI_TEXT = {
  total: 'Total',
  onBoardSince: 'Tiempo en tablero',
  cancelAction: 'Cancelar pedido',
  advanceAction: 'Avanzar',
  chargeAction: 'Cobrar (efectivo)',
  charging: 'Cobrando…',
  paid: 'Pagado',
  pending: 'Pendiente de cobro',
  chargeError: 'No se pudo cobrar. ¿Hay una caja abierta?',
} as const;

interface OrderDetailModalProps {
  order: Order;
  advanceLabel: string;
  onClose: () => void;
}

export function OrderDetailModal({ order, advanceLabel, onClose }: OrderDetailModalProps): JSX.Element {
  const advanceOrder = useAdvanceOrder();
  const cancelOrder = useCancelOrder();
  const chargeOrder = useChargeOrder();
  const isPaid = order.status !== 'pending';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-text/40 p-6"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-md flex-col rounded-2xl bg-surface"
      >
        <div className="flex items-baseline gap-2.5 border-b border-divider px-5 py-4">
          <span className="font-mono text-[20px] font-semibold">{order.ticketNumber}</span>
          <span className="text-[14px] text-muted">{CHANNEL_LABELS[order.channel]}</span>
          <span
            className={
              isPaid
                ? 'ml-auto rounded-full bg-green-100 px-2.5 py-1 text-[12px] font-semibold text-green-700'
                : 'ml-auto rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent-hover'
            }
          >
            {isPaid ? UI_TEXT.paid : UI_TEXT.pending}
          </span>
        </div>

        <div className="flex flex-col gap-3.5 px-5 py-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-baseline gap-2.5 text-[15px]">
              <span className="font-mono text-muted-2">{item.quantity}x</span>
              <span className="min-w-0 flex-1">{item.productName}</span>
              <span className="font-mono text-muted">{formatCurrency(item.subtotal)}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between border-t border-divider pt-3.5">
            <span className="text-[15px] text-muted">{UI_TEXT.total}</span>
            <span className="font-mono text-[21px] font-semibold">
              {formatCurrency(order.total)}
            </span>
          </div>
          <span className="text-[13px] text-muted">
            {UI_TEXT.onBoardSince} {formatElapsedMinutes(order.createdAt)}
          </span>
          {chargeOrder.isError ? (
            <p className="text-sm text-red-600">{UI_TEXT.chargeError}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2.5 bg-bg px-5 py-4">
          <button
            type="button"
            onClick={() => cancelOrder.mutate(order.id, { onSuccess: onClose })}
            disabled={cancelOrder.isPending}
            className="h-11 rounded-lg border border-red-200 px-4 text-[14px] text-red-700 hover:bg-red-50"
          >
            {UI_TEXT.cancelAction}
          </button>
          {!isPaid ? (
            <button
              type="button"
              onClick={() => chargeOrder.mutate(order.id)}
              disabled={chargeOrder.isPending}
              className="h-11 rounded-lg bg-text px-4 text-[14px] font-semibold text-white hover:bg-accent disabled:opacity-60"
            >
              {chargeOrder.isPending ? UI_TEXT.charging : UI_TEXT.chargeAction}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => advanceOrder.mutate(order.id, { onSuccess: onClose })}
            disabled={advanceOrder.isPending}
            className="ml-auto h-11 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover"
          >
            {advanceLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
