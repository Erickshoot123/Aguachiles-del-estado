import type { ProductSummary, SaleChannel } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { CHANNEL_LABELS, formatCurrency } from './channelLabels';
import { useCreateOrder, useProducts } from './hooks';

const UI_TEXT = {
  title: 'Nuevo pedido',
  channelLabel: 'Canal',
  itemsLabel: 'Productos',
  extrasLabel: '¿Quieres agregar algo extra?',
  submit: 'Crear pedido',
  submitting: 'Creando…',
  cancel: 'Cancelar',
  empty: 'Agrega al menos un producto',
  loadingProducts: 'Cargando menú…',
  error: 'No se pudo crear el pedido.',
} as const;

const CHANNEL_OPTIONS: SaleChannel[] = ['counter', 'delivery'];

interface ProductQuantityRowProps {
  product: ProductSummary;
  quantity: number;
  onChange: (quantity: number) => void;
}

function ProductQuantityRow({ product, quantity, onChange }: ProductQuantityRowProps): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 text-sm">{product.name}</span>
      <span className="font-mono text-xs text-muted">{formatCurrency(product.price)}</span>
      <input
        type="number"
        min={0}
        value={quantity}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-16 rounded-lg border border-border px-2 py-1 text-right"
      />
    </div>
  );
}

interface NewOrderModalProps {
  onClose: () => void;
}

export function NewOrderModal({ onClose }: NewOrderModalProps): JSX.Element {
  const productsQuery = useProducts();
  const createOrder = useCreateOrder();
  const [channel, setChannel] = useState<SaleChannel>('counter');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const setQuantity = (productId: string, quantity: number): void => {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, quantity) }));
  };

  const mainProducts = (productsQuery.data ?? []).filter((product) => !product.isComplement);
  const extraProducts = (productsQuery.data ?? []).filter((product) => product.isComplement);
  const hasMainItem = mainProducts.some((product) => (quantities[product.id] ?? 0) > 0);

  // Los extras solo tienen sentido junto a un producto principal: si el
  // cajero quita el principal, su cantidad de extra queda oculta y no debe
  // colarse en el pedido aunque el estado interno todavía la recuerde.
  const orderableProducts = hasMainItem ? [...mainProducts, ...extraProducts] : mainProducts;
  const orderableProductIds = new Set(orderableProducts.map((product) => product.id));
  const items = Object.entries(quantities)
    .filter(([productId, quantity]) => quantity > 0 && orderableProductIds.has(productId))
    .map(([productId, quantity]) => ({ productId, quantity }));

  const handleSubmit = (): void => {
    if (items.length === 0) return;
    createOrder.mutate({ channel, items }, { onSuccess: onClose });
  };

  return (
    <ModalBackdrop
      onClose={onClose}
      contentClassName="flex w-full max-w-md flex-col rounded-2xl bg-surface"
    >
      <div className="border-b border-divider px-5 py-4">
        <h2 className="m-0 text-[17px] font-semibold">{UI_TEXT.title}</h2>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-text" htmlFor="channel">
            {UI_TEXT.channelLabel}
          </label>
          <select
            id="channel"
            value={channel}
            onChange={(event) => setChannel(event.target.value as SaleChannel)}
            className="w-full rounded-lg border border-border px-3 py-2"
          >
            {CHANNEL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {CHANNEL_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-text">{UI_TEXT.itemsLabel}</span>
          {productsQuery.isLoading ? (
            <p className="text-sm text-muted">{UI_TEXT.loadingProducts}</p>
          ) : (
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {mainProducts.map((product) => (
                <ProductQuantityRow
                  key={product.id}
                  product={product}
                  quantity={quantities[product.id] ?? 0}
                  onChange={(quantity) => setQuantity(product.id, quantity)}
                />
              ))}
            </div>
          )}
        </div>

        {hasMainItem && extraProducts.length > 0 ? (
          <div>
            <span className="mb-1 block text-sm font-medium text-text">{UI_TEXT.extrasLabel}</span>
            <div className="flex flex-col gap-2">
              {extraProducts.map((product) => (
                <ProductQuantityRow
                  key={product.id}
                  product={product}
                  quantity={quantities[product.id] ?? 0}
                  onChange={(quantity) => setQuantity(product.id, quantity)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {createOrder.isError ? <p className="text-sm text-red-600">{UI_TEXT.error}</p> : null}
      </div>

      <div className="flex gap-2.5 bg-bg px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-lg border border-border px-4 text-[14px]"
        >
          {UI_TEXT.cancel}
        </button>
        <button
          type="button"
          disabled={items.length === 0 || createOrder.isPending}
          onClick={handleSubmit}
          title={items.length === 0 ? UI_TEXT.empty : undefined}
          className="ml-auto h-11 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {createOrder.isPending ? UI_TEXT.submitting : UI_TEXT.submit}
        </button>
      </div>
    </ModalBackdrop>
  );
}
