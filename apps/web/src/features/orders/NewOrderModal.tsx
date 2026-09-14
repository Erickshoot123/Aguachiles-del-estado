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
  deliveryTitle: 'Datos de entrega',
  customerName: 'Nombre del cliente',
  customerPhone: 'Teléfono',
  deliveryAddress: 'Dirección',
  deliveryReferences: 'Referencias (opcional)',
  deliveryReferencesPlaceholder: 'Entre calles, color de fachada, piso, etc.',
  notes: 'Notas del pedido (opcional)',
  missingDeliveryInfo: 'Completa nombre, teléfono y dirección para pedidos de delivery',
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

interface DeliveryFormState {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryReferences: string;
  notes: string;
}

const EMPTY_DELIVERY_INFO: DeliveryFormState = {
  customerName: '',
  customerPhone: '',
  deliveryAddress: '',
  deliveryReferences: '',
  notes: '',
};

export function NewOrderModal({ onClose }: NewOrderModalProps): JSX.Element {
  const productsQuery = useProducts();
  const createOrder = useCreateOrder();
  const [channel, setChannel] = useState<SaleChannel>('counter');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryFormState>(EMPTY_DELIVERY_INFO);

  const setQuantity = (productId: string, quantity: number): void => {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, quantity) }));
  };

  const setDeliveryField = <K extends keyof DeliveryFormState>(
    key: K,
    value: DeliveryFormState[K],
  ): void => {
    setDeliveryInfo((prev) => ({ ...prev, [key]: value }));
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

  const isDelivery = channel === 'delivery';
  const hasRequiredDeliveryInfo =
    !isDelivery ||
    (deliveryInfo.customerName.trim() !== '' &&
      deliveryInfo.customerPhone.trim() !== '' &&
      deliveryInfo.deliveryAddress.trim() !== '');
  const canSubmit = items.length > 0 && hasRequiredDeliveryInfo;

  const handleSubmit = (): void => {
    if (!canSubmit) return;
    const deliveryPayload = isDelivery
      ? {
          customerName: deliveryInfo.customerName.trim(),
          customerPhone: deliveryInfo.customerPhone.trim(),
          deliveryAddress: deliveryInfo.deliveryAddress.trim(),
          deliveryReferences:
            deliveryInfo.deliveryReferences.trim() === ''
              ? undefined
              : deliveryInfo.deliveryReferences.trim(),
          notes: deliveryInfo.notes.trim() === '' ? undefined : deliveryInfo.notes.trim(),
        }
      : {};
    createOrder.mutate({ channel, items, ...deliveryPayload }, { onSuccess: onClose });
  };

  return (
    <ModalBackdrop
      onClose={onClose}
      contentClassName="flex w-full max-w-md flex-col rounded-2xl bg-surface"
    >
      <div className="border-b border-divider px-5 py-4">
        <h2 className="m-0 text-[17px] font-semibold">{UI_TEXT.title}</h2>
      </div>

      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-5 py-4">
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

        {isDelivery ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <span className="text-sm font-medium text-text">{UI_TEXT.deliveryTitle}</span>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                {UI_TEXT.customerName}
                <input
                  value={deliveryInfo.customerName}
                  onChange={(event) => setDeliveryField('customerName', event.target.value)}
                  className="rounded-lg border border-border px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {UI_TEXT.customerPhone}
                <input
                  type="tel"
                  value={deliveryInfo.customerPhone}
                  onChange={(event) => setDeliveryField('customerPhone', event.target.value)}
                  className="rounded-lg border border-border px-3 py-2"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              {UI_TEXT.deliveryAddress}
              <input
                value={deliveryInfo.deliveryAddress}
                onChange={(event) => setDeliveryField('deliveryAddress', event.target.value)}
                className="rounded-lg border border-border px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              {UI_TEXT.deliveryReferences}
              <input
                value={deliveryInfo.deliveryReferences}
                onChange={(event) => setDeliveryField('deliveryReferences', event.target.value)}
                placeholder={UI_TEXT.deliveryReferencesPlaceholder}
                className="rounded-lg border border-border px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              {UI_TEXT.notes}
              <textarea
                value={deliveryInfo.notes}
                onChange={(event) => setDeliveryField('notes', event.target.value)}
                rows={2}
                className="rounded-lg border border-border px-3 py-2"
              />
            </label>
          </div>
        ) : null}

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
          disabled={!canSubmit || createOrder.isPending}
          onClick={handleSubmit}
          title={
            items.length === 0
              ? UI_TEXT.empty
              : !hasRequiredDeliveryInfo
                ? UI_TEXT.missingDeliveryInfo
                : undefined
          }
          className="ml-auto h-11 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {createOrder.isPending ? UI_TEXT.submitting : UI_TEXT.submit}
        </button>
      </div>
    </ModalBackdrop>
  );
}
