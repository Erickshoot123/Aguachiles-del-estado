import type { CashMovement, CashMovementType } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { formatCurrency } from '../orders/channelLabels';
import { useCashMovements, useCreateCashMovement } from './hooks';

type ManualMovementType = 'withdrawal' | 'deposit';

const UI_TEXT = {
  title: 'Movimientos de caja',
  withdrawal: 'Retiro',
  deposit: 'Ingreso',
  amountLabel: 'Monto',
  descriptionLabel: 'Motivo',
  descriptionPlaceholder: 'Ej. pago a proveedor, retiro para banco…',
  registerAction: 'Registrar',
  registeringAction: 'Registrando…',
  registerError: 'No se pudo registrar el movimiento.',
  noMovements: 'Sin movimientos registrados',
  historyTitle: 'Historial',
} as const;

const MOVEMENT_TYPE_LABELS: Record<CashMovementType, string> = {
  sale_income: 'Venta',
  withdrawal: 'Retiro',
  deposit: 'Ingreso',
  expense: 'Gasto',
  refund: 'Reembolso',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function MovementTypeToggle({
  type,
  onChange,
}: {
  type: ManualMovementType;
  onChange: (type: ManualMovementType) => void;
}): JSX.Element {
  const options: { value: ManualMovementType; label: string }[] = [
    { value: 'withdrawal', label: UI_TEXT.withdrawal },
    { value: 'deposit', label: UI_TEXT.deposit },
  ];
  return (
    <div className="mb-4 flex gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
            type === option.value ? 'border-accent bg-accent-soft text-accent-hover' : 'border-border text-muted'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MovementHistory({ movements }: { movements: CashMovement[] }): JSX.Element {
  if (movements.length === 0) {
    return <p className="text-sm text-muted-2">{UI_TEXT.noMovements}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {movements.map((movement) => (
        <div key={movement.id} className="flex items-baseline justify-between text-[13px]">
          <span className="text-muted">
            {MOVEMENT_TYPE_LABELS[movement.type]} · {formatDateTime(movement.createdAt)}
          </span>
          <span className="font-mono font-semibold">{formatCurrency(movement.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function MovementForm({ sessionId }: { sessionId: string }): JSX.Element {
  const createMovement = useCreateCashMovement(sessionId);
  const [type, setType] = useState<ManualMovementType>('withdrawal');
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');

  const canSubmit = amount > 0 && description.trim() !== '' && !createMovement.isPending;

  const handleSubmit = (): void => {
    if (!canSubmit) return;
    createMovement.mutate(
      { type, amount, description: description.trim() },
      {
        onSuccess: () => {
          setAmount(0);
          setDescription('');
        },
      },
    );
  };

  return (
    <>
      <MovementTypeToggle type={type} onChange={setType} />
      <label className="mb-1 block text-sm font-medium text-text" htmlFor="movement-amount">
        {UI_TEXT.amountLabel}
      </label>
      <input
        id="movement-amount"
        type="number"
        min={0}
        value={amount}
        onChange={(event) => setAmount(Number(event.target.value))}
        className="mb-3 w-full rounded-lg border border-border px-3 py-2"
      />
      <label className="mb-1 block text-sm font-medium text-text" htmlFor="movement-description">
        {UI_TEXT.descriptionLabel}
      </label>
      <input
        id="movement-description"
        type="text"
        value={description}
        placeholder={UI_TEXT.descriptionPlaceholder}
        onChange={(event) => setDescription(event.target.value)}
        className="mb-3 w-full rounded-lg border border-border px-3 py-2"
      />
      {createMovement.isError ? (
        <p className="mb-3 text-sm text-red-600">{UI_TEXT.registerError}</p>
      ) : null}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="mb-5 w-full rounded-lg bg-text px-3 py-2 font-semibold text-white hover:bg-accent disabled:opacity-60"
      >
        {createMovement.isPending ? UI_TEXT.registeringAction : UI_TEXT.registerAction}
      </button>
    </>
  );
}

interface CashMovementsPanelProps {
  sessionId: string;
}

export function CashMovementsPanel({ sessionId }: CashMovementsPanelProps): JSX.Element {
  const movementsQuery = useCashMovements(sessionId);

  return (
    <div className="max-w-sm rounded-2xl border border-border bg-surface p-6">
      <h2 className="m-0 mb-4 text-[17px] font-semibold">{UI_TEXT.title}</h2>
      <MovementForm sessionId={sessionId} />
      <h3 className="m-0 mb-2 text-[13px] font-semibold text-muted">{UI_TEXT.historyTitle}</h3>
      <MovementHistory movements={movementsQuery.data ?? []} />
    </div>
  );
}
