import type { Order } from '@aguachiles/shared';
import type { JSX } from 'react';
import { CHANNEL_LABELS, formatCurrency, formatElapsedMinutes } from './channelLabels';

interface OrderCardProps {
  order: Order;
  advanceLabel: string;
  onOpenDetail: (order: Order) => void;
  onAdvance: (orderId: string) => void;
}

export function OrderCard({ order, advanceLabel, onOpenDetail, onAdvance }: OrderCardProps): JSX.Element {
  return (
    <article
      onClick={() => onOpenDetail(order)}
      className="flex cursor-pointer flex-col gap-2.5 rounded-[11px] border border-border bg-surface p-2.5 hover:border-accent"
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[15px] font-semibold">{order.ticketNumber}</span>
        <span className="text-[12px] text-muted">{CHANNEL_LABELS[order.channel]}</span>
        <span className="ml-auto font-mono text-[12px] text-muted-2">
          {formatElapsedMinutes(order.createdAt)}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {order.items.map((item) => (
          <div key={item.id} className="flex gap-2 text-[13px] text-text">
            <span className="font-mono text-muted-2">{item.quantity}x</span>
            <span>{item.productName}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-divider pt-2.5">
        <span className="font-mono text-[14px] font-semibold">{formatCurrency(order.total)}</span>
        {order.status === 'pending' ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-hover">
            Sin cobrar
          </span>
        ) : null}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAdvance(order.id);
          }}
          className="ml-auto h-9 whitespace-nowrap rounded-lg bg-text px-2.5 text-[13px] font-semibold text-white hover:bg-accent"
        >
          {advanceLabel}
        </button>
      </div>
    </article>
  );
}
