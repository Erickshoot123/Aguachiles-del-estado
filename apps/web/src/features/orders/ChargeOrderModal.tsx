import type { ChargePayment, Order, PaymentMethod } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { usePaymentMethods } from '../payments/hooks';
import { formatCurrency } from './channelLabels';
import { useChargeOrder } from './hooks';

const UI_TEXT = {
  title: 'Cobrar pedido',
  totalLabel: 'Total del pedido',
  paidLabel: 'Pagado',
  remainingLabel: 'Restante',
  referencePlaceholder: 'Referencia (opcional)',
  addPayment: 'Agregar otro método',
  removePayment: 'Quitar',
  loadingMethods: 'Cargando métodos de pago…',
  cancel: 'Cancelar',
  submit: 'Confirmar cobro',
  submitting: 'Cobrando…',
  submitError: 'No se pudo cobrar. ¿Hay una caja abierta?',
} as const;

interface PaymentLine {
  paymentMethodId: string;
  amount: string;
  reference: string;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function useChargeForm(orderTotal: number, methods: PaymentMethod[]) {
  const [lines, setLines] = useState<PaymentLine[] | null>(null);

  const effectiveLines: PaymentLine[] =
    lines ??
    (methods.length > 0
      ? [{ paymentMethodId: methods[0]!.id, amount: orderTotal.toFixed(2), reference: '' }]
      : []);

  const updateLine = (index: number, patch: Partial<PaymentLine>): void => {
    setLines(effectiveLines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };
  const addLine = (): void => {
    if (methods.length === 0) return;
    setLines([...effectiveLines, { paymentMethodId: methods[0]!.id, amount: '', reference: '' }]);
  };
  const removeLine = (index: number): void => {
    setLines(effectiveLines.filter((_, i) => i !== index));
  };

  const paidTotal = round2(effectiveLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0));
  const remaining = round2(orderTotal - paidTotal);

  return { effectiveLines, updateLine, addLine, removeLine, paidTotal, remaining };
}

function PaymentLineRow({
  line,
  methods,
  canRemove,
  onChange,
  onRemove,
}: {
  line: PaymentLine;
  methods: PaymentMethod[];
  canRemove: boolean;
  onChange: (patch: Partial<PaymentLine>) => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <select
        value={line.paymentMethodId}
        onChange={(event) => onChange({ paymentMethodId: event.target.value })}
        className="rounded-lg border border-border px-2 py-2 text-sm"
      >
        {methods.map((method) => (
          <option key={method.id} value={method.id}>
            {method.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={0}
        step="0.01"
        value={line.amount}
        onChange={(event) => onChange({ amount: event.target.value })}
        className="w-24 rounded-lg border border-border px-2 py-2 text-right text-sm"
      />
      <input
        type="text"
        value={line.reference}
        placeholder={UI_TEXT.referencePlaceholder}
        onChange={(event) => onChange({ reference: event.target.value })}
        className="min-w-0 flex-1 rounded-lg border border-border px-2 py-2 text-sm"
      />
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg border border-border px-2 py-2 text-xs text-muted hover:border-border-hover"
        >
          {UI_TEXT.removePayment}
        </button>
      ) : null}
    </div>
  );
}

function PaymentLinesSection({
  lines,
  methods,
  onChange,
  onRemove,
  onAdd,
}: {
  lines: PaymentLine[];
  methods: PaymentMethod[];
  onChange: (index: number, patch: Partial<PaymentLine>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, index) => (
        <PaymentLineRow
          key={index}
          line={line}
          methods={methods}
          canRemove={lines.length > 1}
          onChange={(patch) => onChange(index, patch)}
          onRemove={() => onRemove(index)}
        />
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="self-start rounded-lg border border-border px-3 py-1.5 text-[13px] hover:border-border-hover"
      >
        {UI_TEXT.addPayment}
      </button>
    </div>
  );
}

function PaymentSummary({ paidTotal, remaining }: { paidTotal: number; remaining: number }): JSX.Element {
  const isBalanced = remaining === 0;
  return (
    <div className="flex flex-col gap-1 border-t border-divider pt-3 text-sm">
      <div className="flex justify-between">
        <span className="text-muted">{UI_TEXT.paidLabel}</span>
        <span className="font-mono">{formatCurrency(paidTotal)}</span>
      </div>
      <div className="flex justify-between font-semibold">
        <span>{UI_TEXT.remainingLabel}</span>
        <span className={`font-mono ${isBalanced ? '' : 'text-red-600'}`}>
          {formatCurrency(remaining)}
        </span>
      </div>
    </div>
  );
}

interface ChargeOrderModalProps {
  order: Order;
  cashRegisterId: string;
  onClose: () => void;
}

export function ChargeOrderModal({
  order,
  cashRegisterId,
  onClose,
}: ChargeOrderModalProps): JSX.Element {
  const paymentMethodsQuery = usePaymentMethods();
  const chargeOrder = useChargeOrder();
  const methods = paymentMethodsQuery.data ?? [];
  const { effectiveLines, updateLine, addLine, removeLine, paidTotal, remaining } = useChargeForm(
    order.total,
    methods,
  );

  const canSubmit =
    remaining === 0 &&
    effectiveLines.length > 0 &&
    effectiveLines.every((line) => line.paymentMethodId && Number(line.amount) > 0) &&
    !chargeOrder.isPending;

  const handleSubmit = (): void => {
    if (!canSubmit) return;
    const payments: ChargePayment[] = effectiveLines.map((line) => ({
      paymentMethodId: line.paymentMethodId,
      amount: round2(Number(line.amount)),
      reference: line.reference.trim() === '' ? undefined : line.reference.trim(),
    }));
    chargeOrder.mutate(
      { orderId: order.id, input: { cashRegisterId, payments } },
      { onSuccess: onClose },
    );
  };

  return (
    <ModalBackdrop
      onClose={onClose}
      zIndexClassName="z-50"
      contentClassName="flex w-full max-w-lg flex-col rounded-2xl bg-surface"
    >
      <div className="border-b border-divider px-5 py-4">
        <h2 className="m-0 text-[17px] font-semibold">{UI_TEXT.title}</h2>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex justify-between text-[15px]">
          <span className="text-muted">{UI_TEXT.totalLabel}</span>
          <span className="font-mono font-semibold">{formatCurrency(order.total)}</span>
        </div>

        {paymentMethodsQuery.isLoading ? (
          <p className="text-sm text-muted">{UI_TEXT.loadingMethods}</p>
        ) : (
          <PaymentLinesSection
            lines={effectiveLines}
            methods={methods}
            onChange={updateLine}
            onRemove={removeLine}
            onAdd={addLine}
          />
        )}

        <PaymentSummary paidTotal={paidTotal} remaining={remaining} />

        {chargeOrder.isError ? <p className="text-sm text-red-600">{UI_TEXT.submitError}</p> : null}
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
          className="ml-auto h-11 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {chargeOrder.isPending ? UI_TEXT.submitting : UI_TEXT.submit}
        </button>
      </div>
    </ModalBackdrop>
  );
}
