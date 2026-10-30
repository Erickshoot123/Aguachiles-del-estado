import type { ProductSummary } from '@aguachiles/shared';
import type { JSX } from 'react';
import { formatCurrency } from './channelLabels';

interface ProductCardProps {
  disabled?: boolean;
  product: ProductSummary;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function ProductCard({ product, quantity, onIncrement, onDecrement, disabled }: ProductCardProps): JSX.Element {
  const selected = quantity > 0;
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl border transition-colors ${
        selected
          ? 'border-accent bg-accent-soft shadow-sm'
          : 'border-border bg-surface hover:border-border-hover'
      }`}
    >
      {selected ? (
        <span className="absolute right-2 top-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 font-mono text-xs font-semibold text-white">
          {quantity}
        </span>
      ) : null}

      {/* Tap directo en el cuerpo de la tarjeta = +1 */}
      <button
        type="button"
        onClick={onIncrement}
        disabled={disabled}
        aria-label={`${'Agregar uno'}: ${product.name}`}
        className="flex min-h-[64px] flex-1 flex-col justify-between gap-2 p-3 text-left"
      >
        <span className="text-sm font-medium leading-snug text-text">{product.name}</span>
        <span className="font-mono text-sm font-semibold text-accent">
          {formatCurrency(product.price)}
        </span>
      </button>

      {selected ? (
        <div className="flex items-stretch border-t border-accent/30">
          <button
            type="button"
            onClick={onDecrement}
            aria-label={`${'Quitar uno'}: ${product.name}`}
            className="flex h-12 flex-1 items-center justify-center text-xl font-semibold text-accent active:bg-accent/10"
          >
            −
          </button>
          <span className="flex h-12 w-12 items-center justify-center border-x border-accent/30 font-mono text-base font-semibold text-text">
            {quantity}
          </span>
          <button
            type="button"
            onClick={onIncrement}
            disabled={disabled}
            aria-label={`${'Agregar uno'}: ${product.name}`}
            className="flex h-12 flex-1 items-center justify-center text-xl font-semibold text-accent active:bg-accent/10"
          >
            +
          </button>
        </div>
      ) : null}
    </div>
  );
}
