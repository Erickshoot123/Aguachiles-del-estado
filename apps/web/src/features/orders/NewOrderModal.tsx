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
  total: 'Total',
  decrease: 'Quitar uno',
  increase: 'Agregar uno',
} as const;

const CHANNEL_OPTIONS: SaleChannel[] = ['counter', 'delivery'];

// Grid táctil: tantas columnas como quepan sin bajar de 140px por tarjeta.
const PRODUCT_GRID_CLASS =
  'grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]';

interface ProductCardProps {
  product: ProductSummary;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

function ProductCard({ product, quantity, onIncrement, onDecrement }: ProductCardProps): JSX.Element {
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
        aria-label={`${UI_TEXT.increase}: ${product.name}`}
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
            aria-label={`${UI_TEXT.decrease}: ${product.name}`}
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
            aria-label={`${UI_TEXT.increase}: ${product.name}`}
            className="flex h-12 flex-1 items-center justify-center text-xl font-semibold text-accent active:bg-accent/10"
          >
            +
          </button>
        </div>
      ) : null}
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
  const incrementProduct = (productId: string): void => {
    setQuantity(productId, (quantities[productId] ?? 0) + 1);
  };
  const decrementProduct = (productId: string): void => {
    setQuantity(productId, (quantities[productId] ?? 0) - 1);
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

  const priceByProductId = new Map(
    orderableProducts.map((product) => [product.id, product.price]),
  );
  const totalAmount = items.reduce(
    (sum, item) => sum + (priceByProductId.get(item.productId) ?? 0) * item.quantity,
    0,
  );
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

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
      contentClassName="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-surface"
    >
      <div className="border-b border-divider px-5 py-4">
        <h2 className="m-0 text-[17px] font-semibold">{UI_TEXT.title}</h2>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">{UI_TEXT.channelLabel}</span>
          <div role="group" aria-label={UI_TEXT.channelLabel} className="grid grid-cols-2 gap-2">
            {CHANNEL_OPTIONS.map((option) => {
              const active = channel === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setChannel(option)}
                  aria-pressed={active}
                  className={`h-12 rounded-xl text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-accent text-white shadow-sm'
                      : 'border border-border bg-surface text-text hover:border-border-hover'
                  }`}
                >
                  {CHANNEL_LABELS[option]}
                </button>
              );
            })}
          </div>
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
                  className="h-11 rounded-lg border border-border px-3"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {UI_TEXT.customerPhone}
                <input
                  type="tel"
                  value={deliveryInfo.customerPhone}
                  onChange={(event) => setDeliveryField('customerPhone', event.target.value)}
                  className="h-11 rounded-lg border border-border px-3"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              {UI_TEXT.deliveryAddress}
              <input
                value={deliveryInfo.deliveryAddress}
                onChange={(event) => setDeliveryField('deliveryAddress', event.target.value)}
                className="h-11 rounded-lg border border-border px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              {UI_TEXT.deliveryReferences}
              <input
                value={deliveryInfo.deliveryReferences}
                onChange={(event) => setDeliveryField('deliveryReferences', event.target.value)}
                placeholder={UI_TEXT.deliveryReferencesPlaceholder}
                className="h-11 rounded-lg border border-border px-3"
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
          <span className="mb-1.5 block text-sm font-medium text-text">{UI_TEXT.itemsLabel}</span>
          {productsQuery.isLoading ? (
            <p className="text-sm text-muted">{UI_TEXT.loadingProducts}</p>
          ) : (
            <div className={PRODUCT_GRID_CLASS}>
              {mainProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={quantities[product.id] ?? 0}
                  onIncrement={() => incrementProduct(product.id)}
                  onDecrement={() => decrementProduct(product.id)}
                />
              ))}
            </div>
          )}
        </div>

        {hasMainItem && extraProducts.length > 0 ? (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">{UI_TEXT.extrasLabel}</span>
            <div className={PRODUCT_GRID_CLASS}>
              {extraProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={quantities[product.id] ?? 0}
                  onIncrement={() => incrementProduct(product.id)}
                  onDecrement={() => decrementProduct(product.id)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {createOrder.isError ? <p className="text-sm text-red-600">{UI_TEXT.error}</p> : null}
      </div>

      <div className="flex items-center gap-3 border-t border-divider bg-bg px-5 py-4">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted">{UI_TEXT.total}</span>
          <span className="font-mono text-xl font-semibold text-text">
            {formatCurrency(totalAmount)}
            {totalUnits > 0 ? (
              <span className="ml-2 text-sm font-normal text-muted">
                {totalUnits} {totalUnits === 1 ? 'artículo' : 'artículos'}
              </span>
            ) : null}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="ml-auto h-14 rounded-xl border border-border px-5 text-[15px] font-medium"
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
          className="h-14 rounded-xl bg-accent px-6 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {createOrder.isPending ? UI_TEXT.submitting : UI_TEXT.submit}
        </button>
      </div>
    </ModalBackdrop>
  );
}
