import type { Supplier } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { useCatalogProducts } from '../catalog/hooks';
import { useCreatePurchase } from './hooks';

const UI_TEXT = {
  title: 'Nueva compra',
  supplierLabel: 'Proveedor',
  reasonLabel: 'Referencia (opcional)',
  reasonPlaceholder: 'Ej. folio de factura, nota de remisión…',
  itemsLabel: 'Productos recibidos',
  loadingProducts: 'Cargando menú…',
  cancel: 'Cancelar',
  submit: 'Registrar compra',
  submitting: 'Registrando…',
  empty: 'Agrega al menos un producto',
  error: 'No se pudo registrar la compra.',
} as const;

interface PurchaseFormModalProps {
  suppliers: Supplier[];
  onClose: () => void;
}

export function PurchaseFormModal({ suppliers, onClose }: PurchaseFormModalProps): JSX.Element {
  const productsQuery = useCatalogProducts();
  const createPurchase = useCreatePurchase();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const setQuantity = (productId: string, quantity: number): void => {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, quantity) }));
  };

  const items = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));

  const canSubmit = supplierId !== '' && items.length > 0 && !createPurchase.isPending;

  const handleSubmit = (): void => {
    if (!canSubmit) return;
    createPurchase.mutate(
      { supplierId, reason: reason.trim() === '' ? undefined : reason.trim(), items },
      { onSuccess: onClose },
    );
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
        <label className="flex flex-col gap-1 text-sm">
          {UI_TEXT.supplierLabel}
          <select
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            className="rounded-lg border border-border px-3 py-2"
          >
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {UI_TEXT.reasonLabel}
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={UI_TEXT.reasonPlaceholder}
            className="rounded-lg border border-border px-3 py-2"
          />
        </label>

        <div>
          <span className="mb-1 block text-sm font-medium text-text">{UI_TEXT.itemsLabel}</span>
          {productsQuery.isLoading ? (
            <p className="text-sm text-muted">{UI_TEXT.loadingProducts}</p>
          ) : (
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {(productsQuery.data ?? []).map((product) => (
                <div key={product.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 text-sm">{product.name}</span>
                  <span className="font-mono text-xs text-muted">{product.stock}</span>
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

        {createPurchase.isError ? <p className="text-sm text-red-600">{UI_TEXT.error}</p> : null}
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
          disabled={!canSubmit}
          onClick={handleSubmit}
          title={items.length === 0 ? UI_TEXT.empty : undefined}
          className="ml-auto h-11 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {createPurchase.isPending ? UI_TEXT.submitting : UI_TEXT.submit}
        </button>
      </div>
    </ModalBackdrop>
  );
}
