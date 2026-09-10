import type { Order } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { usePermission } from '../auth/authStore';
import { useTerminalCashRegisterId } from '../cash/terminalStore';
import { RefundModal } from '../refunds/RefundModal';
import { TicketModal } from '../receipts/TicketModal';
import { ChargeOrderModal } from './ChargeOrderModal';
import { CHANNEL_LABELS, formatCurrency, formatElapsedMinutes } from './channelLabels';
import { useAdvanceOrder, useCancelOrder } from './hooks';

const UI_TEXT = {
  total: 'Total',
  onBoardSince: 'Tiempo en tablero',
  cancelAction: 'Cancelar pedido',
  chargeAction: 'Cobrar',
  noRegisterSelected: 'Selecciona la caja de esta terminal en "Caja y cierre"',
  ticketAction: 'Ticket',
  refundAction: 'Reembolsar',
  statusPending: 'Pendiente de cobro',
  statusPaid: 'Pagado',
  statusPartiallyRefunded: 'Reembolso parcial',
  statusRefunded: 'Reembolsado',
  statusCancelled: 'Cancelado',
} as const;

const STATUS_BADGE: Record<Order['status'], { label: string; className: string }> = {
  pending: { label: UI_TEXT.statusPending, className: 'bg-accent-soft text-accent-hover' },
  completed: { label: UI_TEXT.statusPaid, className: 'bg-green-100 text-green-700' },
  partially_refunded: { label: UI_TEXT.statusPartiallyRefunded, className: 'bg-amber-100 text-amber-700' },
  refunded: { label: UI_TEXT.statusRefunded, className: 'bg-bg text-muted-2' },
  cancelled: { label: UI_TEXT.statusCancelled, className: 'bg-bg text-muted-2' },
};

interface OrderDetailModalProps {
  order: Order;
  advanceLabel: string | null;
  onClose: () => void;
}

export function OrderDetailModal({
  order,
  advanceLabel,
  onClose,
}: OrderDetailModalProps): JSX.Element {
  const advanceOrder = useAdvanceOrder();
  const cancelOrder = useCancelOrder();
  const cashRegisterId = useTerminalCashRegisterId();
  const canCreateRefund = usePermission('refunds.create');
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isChargeOpen, setIsChargeOpen] = useState(false);

  const canCancelOrCharge = order.status === 'pending';
  const hasReceipt = order.status !== 'pending' && order.status !== 'cancelled';
  const canRefund =
    (order.status === 'completed' || order.status === 'partially_refunded') && canCreateRefund;
  const badge = STATUS_BADGE[order.status];

  return (
    <>
      <ModalBackdrop
        onClose={onClose}
        contentClassName="flex w-full max-w-md flex-col rounded-2xl bg-surface"
      >
        <div className="flex items-baseline gap-2.5 border-b border-divider px-5 py-4">
          <span className="font-mono text-[20px] font-semibold">{order.ticketNumber}</span>
          <span className="text-[14px] text-muted">{CHANNEL_LABELS[order.channel]}</span>
          <span className={`ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold ${badge.className}`}>
            {badge.label}
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
        </div>

        <div className="flex flex-wrap gap-2.5 bg-bg px-5 py-4">
          {canCancelOrCharge ? (
            <button
              type="button"
              onClick={() => cancelOrder.mutate(order.id, { onSuccess: onClose })}
              disabled={cancelOrder.isPending}
              className="h-11 rounded-lg border border-red-200 px-4 text-[14px] text-red-700 hover:bg-red-50"
            >
              {UI_TEXT.cancelAction}
            </button>
          ) : null}
          {canCancelOrCharge ? (
            <button
              type="button"
              onClick={() => setIsChargeOpen(true)}
              disabled={!cashRegisterId}
              title={!cashRegisterId ? UI_TEXT.noRegisterSelected : undefined}
              className="h-11 rounded-lg bg-text px-4 text-[14px] font-semibold text-white hover:bg-accent disabled:opacity-60"
            >
              {UI_TEXT.chargeAction}
            </button>
          ) : null}
          {hasReceipt ? (
            <button
              type="button"
              onClick={() => setIsTicketOpen(true)}
              className="h-11 rounded-lg border border-border px-4 text-[14px] hover:border-border-hover"
            >
              {UI_TEXT.ticketAction}
            </button>
          ) : null}
          {canRefund ? (
            <button
              type="button"
              onClick={() => setIsRefundOpen(true)}
              className="h-11 rounded-lg border border-red-200 px-4 text-[14px] text-red-700 hover:bg-red-50"
            >
              {UI_TEXT.refundAction}
            </button>
          ) : null}
          {advanceLabel ? (
            <button
              type="button"
              onClick={() => advanceOrder.mutate(order.id, { onSuccess: onClose })}
              disabled={advanceOrder.isPending}
              className="ml-auto h-11 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover"
            >
              {advanceLabel}
            </button>
          ) : null}
        </div>
      </ModalBackdrop>

      {isTicketOpen ? (
        <TicketModal orderId={order.id} onClose={() => setIsTicketOpen(false)} />
      ) : null}
      {isRefundOpen ? (
        <RefundModal orderId={order.id} onClose={() => setIsRefundOpen(false)} />
      ) : null}
      {isChargeOpen && cashRegisterId ? (
        <ChargeOrderModal
          order={order}
          cashRegisterId={cashRegisterId}
          onClose={() => setIsChargeOpen(false)}
        />
      ) : null}
    </>
  );
}
