import type { SaleChannel } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { CHANNEL_LABELS, formatCurrency } from './channelLabels';
import { useCreateOrder, useProducts } from './hooks';
import { usePlateAvailability } from '../plates/hooks';
import { ProductCard } from './ProductCard';
import { PortionPreferences, describePortion, emptyPortionPreferences, type PortionPreferencesValue } from './PortionPreferences';
import { ApiError } from '../../lib/apiClient';

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
  missingDeliveryInfo: 'Completa nombre, teléfono y dirección para pedidos de delivery',
  total: 'Total',
} as const;

const CHANNEL_OPTIONS: SaleChannel[] = ['delivery', 'counter'];

// Grid táctil: tantas columnas como quepan sin bajar de 140px por tarjeta.
const PRODUCT_GRID_CLASS =
  'grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]';

interface NewOrderModalProps {
  onClose: () => void;
}

interface DeliveryFormState {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryReferences: string;
}

const EMPTY_DELIVERY_INFO: DeliveryFormState = {
  customerName: '',
  customerPhone: '',
  deliveryAddress: '',
  deliveryReferences: '',
};

export function NewOrderModal({ onClose }: NewOrderModalProps): JSX.Element {
  const platesQuery = usePlateAvailability();
  const productsQuery = useProducts();
  const createOrder = useCreateOrder();
  const [channel, setChannel] = useState<SaleChannel>('delivery');
  const [portionPreferences, setPortionPreferences] = useState<Record<string, PortionPreferencesValue[]>>({});
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryFormState>(EMPTY_DELIVERY_INFO);

  const setQuantity = (productId: string, quantity: number): void => {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, quantity) }));
    setPortionPreferences((prev) => ({ ...prev, [productId]: Array.from({ length: Math.max(0, quantity) },
      (_, index) => prev[productId]?.[index] ?? emptyPortionPreferences()) }));
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
    .flatMap(([productId, quantity]) => mainProducts.find((product) => product.id === productId)?.plateSize
      ? Array.from({ length: quantity }, (_, index) => ({ productId, quantity: 1,
        notes: describePortion(portionPreferences[productId]?.[index] ?? emptyPortionPreferences()) }))
      : [{ productId, quantity, notes: undefined }]);

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
  const selectedPlates = { kilo: 0, half_kilo: 0 };
  for (const product of mainProducts) {
    if (product.plateSize) selectedPlates[product.plateSize] += quantities[product.id] ?? 0;
  }
  const availablePlates = (size: 'kilo' | 'half_kilo') => platesQuery.data?.buckets.find((bucket) => bucket.size === size)?.available ?? 0;
  const hasPlates = Boolean(platesQuery.data?.initialized) && selectedPlates.kilo <= availablePlates('kilo')
    && selectedPlates.half_kilo <= availablePlates('half_kilo');
  const canSubmit = items.length > 0 && hasRequiredDeliveryInfo && hasPlates;

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
        }
      : {};
    createOrder.mutate({ channel, items, ...deliveryPayload, notes: notes.trim() || undefined }, { onSuccess: onClose });
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
                  disabled={Boolean(product.plateSize && selectedPlates[product.plateSize] >= availablePlates(product.plateSize))}
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

        {mainProducts.filter((product) => product.plateSize && (quantities[product.id] ?? 0) > 0).map((product) =>
          <div key={product.id} className="flex flex-col gap-2">
            {Array.from({ length: quantities[product.id] ?? 0 }, (_, index) => <PortionPreferences
              key={index} label={`${product.name} · Porción ${index + 1}`}
              value={portionPreferences[product.id]?.[index] ?? emptyPortionPreferences()}
              onChange={(value) => setPortionPreferences((prev) => ({ ...prev,
                [product.id]: Array.from({ length: quantities[product.id] ?? 0 }, (_, position) =>
                  position === index ? value : prev[product.id]?.[position] ?? emptyPortionPreferences()) }))} />)}
          </div>)}
        <label className="flex flex-col gap-1 text-sm">Notas generales del pedido (opcional)
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2}
            placeholder="Indicaciones generales de entrega…" className="rounded-lg border border-border px-3 py-2" />
        </label>

        {!hasPlates ? <p role="alert" className="text-sm text-red-600">Revisa la disponibilidad de platos antes de crear el pedido.</p> : null}
        <p className="text-sm text-muted">Disponibles: {availablePlates('kilo')} de kilo · {availablePlates('half_kilo')} de medio kilo. Se comparten entre todos los sabores.</p>
        {createOrder.isError ? <p className="text-sm text-red-600">{createOrder.error instanceof ApiError ? createOrder.error.message : UI_TEXT.error}</p> : null}
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
