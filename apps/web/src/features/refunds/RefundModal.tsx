import type { JSX } from 'react';
import { useState } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { useTerminalCashRegisterId } from '../cash/terminalStore';
import { formatCurrency } from '../orders/channelLabels';
import { useCreateRefund, useRefundableSale } from './hooks';

const UI_TEXT = {
  title: 'Reembolsar pedido',
  loading: 'Cargando…',
  error: 'No se pudo cargar la información del reembolso.',
  productCol: 'Producto',
  availableCol: 'Disponible',
  refundCol: 'A reembolsar',
  reasonLabel: 'Motivo',
  reasonPlaceholder: 'Ej. producto en mal estado, pedido no entregado…',
  cancel: 'Cancelar',
  submit: 'Confirmar reembolso',
  submitting: 'Procesando…',
  submitError: 'No se pudo procesar el reembolso. ¿Hay una caja abierta?',
  nothingToRefund: 'Este pedido ya fue reembolsado por completo.',
  totalLabel: 'Total a reembolsar',
  noRegisterSelected: 'Selecciona la caja de esta terminal en "Caja y cierre"',
} as const;

interface RefundModalProps {
  orderId: string;
  onClose: () => void;
}

export function RefundModal({ orderId, onClose }: RefundModalProps): JSX.Element {
  const refundableQuery = useRefundableSale(orderId, true);
  const createRefund = useCreateRefund(orderId);
  const cashRegisterId = useTerminalCashRegisterId();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');

  const sale = refundableQuery.data;
  const hasRefundableItems = (sale?.items ?? []).some((item) => item.refundableQuantity > 0);

  const setQuantity = (saleItemId: string, value: number, max: number): void => {
    const clamped = Math.max(0, Math.min(value, max));
    setQuantities((prev) => ({ ...prev, [saleItemId]: clamped }));
  };

  const items = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([saleItemId, quantity]) => ({ saleItemId, quantity }));

  const total = items.reduce((sum, item) => {
    const saleItem = sale?.items.find((candidate) => candidate.saleItemId === item.saleItemId);
    return sum + (saleItem ? saleItem.unitPrice * item.quantity : 0);
  }, 0);

  const canSubmit =
    items.length > 0 && reason.trim() !== '' && cashRegisterId !== null && !createRefund.isPending;

  const handleSubmit = (): void => {
    if (!canSubmit || !cashRegisterId) return;
    createRefund.mutate({ cashRegisterId, reason: reason.trim(), items }, { onSuccess: onClose });
  };

  return (
    <ModalBackdrop
      onClose={onClose}
      zIndexClassName="z-50"
      contentClassName="flex w-full max-w-md flex-col rounded-2xl bg-surface"
    >
      <div className="border-b border-divider px-5 py-4">
        <h2 className="m-0 text-[17px] font-semibold">{UI_TEXT.title}</h2>
      </div>

      <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto px-5 py-4">
        {refundableQuery.isLoading ? <p className="text-sm text-muted">{UI_TEXT.loading}</p> : null}
        {refundableQuery.isError ? <p className="text-sm text-red-600">{UI_TEXT.error}</p> : null}

        {sale && !hasRefundableItems ? (
          <p className="text-sm text-muted">{UI_TEXT.nothingToRefund}</p>
        ) : null}

        {sale && hasRefundableItems ? (
          <>
            <div className="flex flex-col gap-2">
              {sale.items
                .filter((item) => item.refundableQuantity > 0)
                .map((item) => (
                  <div key={item.saleItemId} className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1">{item.productName}</span>
                    <span className="font-mono text-muted-2">
                      {UI_TEXT.availableCol} {item.refundableQuantity}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={item.refundableQuantity}
                      value={quantities[item.saleItemId] ?? 0}
                      onChange={(event) =>
                        setQuantity(item.saleItemId, Number(event.target.value), item.refundableQuantity)
                      }
                      className="w-16 rounded-lg border border-border px-2 py-1 text-right"
                    />
                  </div>
                ))}
            </div>

            <label className="flex flex-col gap-1 text-sm">
              {UI_TEXT.reasonLabel}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={UI_TEXT.reasonPlaceholder}
                rows={2}
                className="rounded-lg border border-border px-3 py-2"
              />
            </label>

            <div className="flex justify-between border-t border-divider pt-3 text-[15px] font-semibold">
              <span>{UI_TEXT.totalLabel}</span>
              <span className="font-mono">{formatCurrency(total)}</span>
            </div>

            {createRefund.isError ? (
              <p className="text-sm text-red-600">{UI_TEXT.submitError}</p>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="flex gap-2.5 bg-bg px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-lg border border-border px-4 text-[14px]"
        >
          {UI_TEXT.cancel}
        </button>
        {hasRefundableItems ? (
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            title={!cashRegisterId ? UI_TEXT.noRegisterSelected : undefined}
            className="ml-auto h-11 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {createRefund.isPending ? UI_TEXT.submitting : UI_TEXT.submit}
          </button>
        ) : null}
      </div>
    </ModalBackdrop>
  );
}
