import type { SaleChannel } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { CHANNEL_LABELS, formatCurrency } from './channelLabels';
import { useCreateOrder, useProducts } from './hooks';

const UI_TEXT = {
  title: 'Nuevo pedido',
  channelLabel: 'Canal',
  itemsLabel: 'Productos',
  submit: 'Crear pedido',
  submitting: 'Creando…',
  cancel: 'Cancelar',
  empty: 'Agrega al menos un producto',
  loadingProducts: 'Cargando menú…',
  error: 'No se pudo crear el pedido.',
} as const;

const CHANNEL_OPTIONS: SaleChannel[] = ['digital_counter', 'own_app', 'phone', 'whatsapp', 'other'];

interface NewOrderModalProps {
  onClose: () => void;
}

export function NewOrderModal({ onClose }: NewOrderModalProps): JSX.Element {
  const productsQuery = useProducts();
  const createOrder = useCreateOrder();
  const [channel, setChannel] = useState<SaleChannel>('digital_counter');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const setQuantity = (productId: string, quantity: number): void => {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, quantity) }));
  };

  const items = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));

  const handleSubmit = (): void => {
    if (items.length === 0) return;
    createOrder.mutate(
      { channel, items },
      { onSuccess: onClose },
    );
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-text/40 p-6"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-md flex-col rounded-2xl bg-surface"
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
                {(productsQuery.data ?? []).map((product) => (
                  <div key={product.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 text-sm">{product.name}</span>
                    <span className="font-mono text-xs text-muted">
                      {formatCurrency(product.price)}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={quantities[product.id] ?? 0}
                      onChange={(event) => setQuantity(product.id, Number(event.target.value))}
                      className="w-16 rounded-lg border border-border px-2 py-1 text-right"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

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
      </div>
    </div>
  );
}
