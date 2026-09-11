import type { InventoryAdjustmentType, Product } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { useAdjustInventory } from './hooks';

const UI_TEXT = {
  title: 'Ajustar stock',
  currentStock: 'Stock actual',
  type: 'Tipo de ajuste',
  typeIn: 'Entrada (sobrante, devolución de proveedor, etc.)',
  typeOut: 'Salida (merma, daño, pérdida, etc.)',
  quantity: 'Cantidad',
  reason: 'Razón del ajuste',
  reasonPlaceholder: 'Ej. Conteo físico: 3 piezas dañadas por humedad',
  cancel: 'Cancelar',
  save: 'Registrar ajuste',
  saving: 'Registrando…',
  error: 'No se pudo registrar el ajuste. Revisa la cantidad y que el stock resultante no sea negativo.',
} as const;

interface InventoryAdjustmentModalProps {
  product: Pick<Product, 'id' | 'name' | 'stock'>;
  onClose: () => void;
}

export function InventoryAdjustmentModal({
  product,
  onClose,
}: InventoryAdjustmentModalProps): JSX.Element {
  const adjustInventory = useAdjustInventory();
  const [type, setType] = useState<InventoryAdjustmentType>('adjustment_in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const canSubmit = Number(quantity) > 0 && reason.trim() !== '';

  const handleSubmit = (): void => {
    adjustInventory.mutate(
      { productId: product.id, input: { type, quantity: Number(quantity), reason: reason.trim() } },
      { onSuccess: onClose },
    );
  };

  return (
    <ModalBackdrop
      onClose={onClose}
      contentClassName="flex w-full max-w-sm flex-col rounded-2xl bg-surface"
    >
      <div className="border-b border-divider px-5 py-4">
        <h2 className="m-0 text-[17px] font-semibold">{UI_TEXT.title}</h2>
        <p className="mt-1 text-sm text-muted">{product.name}</p>
      </div>

      <div className="flex flex-col gap-3 px-5 py-4">
        <p className="text-sm text-muted">
          {UI_TEXT.currentStock}: <span className="font-mono font-medium text-text">{product.stock}</span>
        </p>

        <label className="flex flex-col gap-1 text-sm">
          {UI_TEXT.type}
          <select
            value={type}
            onChange={(event) => setType(event.target.value as InventoryAdjustmentType)}
            className="rounded-lg border border-border px-3 py-2"
          >
            <option value="adjustment_in">{UI_TEXT.typeIn}</option>
            <option value="adjustment_out">{UI_TEXT.typeOut}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {UI_TEXT.quantity}
          <input
            type="number"
            min={0}
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="rounded-lg border border-border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {UI_TEXT.reason}
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={UI_TEXT.reasonPlaceholder}
            rows={2}
            className="rounded-lg border border-border px-3 py-2"
          />
        </label>

        {adjustInventory.isError ? <p className="text-sm text-red-600">{UI_TEXT.error}</p> : null}
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
          disabled={!canSubmit || adjustInventory.isPending}
          onClick={handleSubmit}
          className="ml-auto h-11 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {adjustInventory.isPending ? UI_TEXT.saving : UI_TEXT.save}
        </button>
      </div>
    </ModalBackdrop>
  );
}
