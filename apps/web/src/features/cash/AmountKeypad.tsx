import type { JSX } from 'react';

export function AmountKeypad({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}): JSX.Element {
  const append = (key: string): void => {
    if (key === 'backspace') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.' && value.includes('.')) return;
    const next =
      key === '.' && value === '' ? '0.' : value === '0' && key !== '.' ? key : value + key;
    if (/^\d{0,6}(\.\d{0,2})?$/.test(next) && Number(next) <= 100000) onChange(next);
  };
  return (
    <div role="group" aria-label="Teclado numérico del monto">
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>Ingresa el monto</span>
        <button
          type="button"
          disabled={disabled || !value}
          onClick={() => onChange('')}
          className="rounded px-2 py-1 font-medium text-accent-hover disabled:opacity-40"
        >
          Borrar todo
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map((key) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-label={
              key === 'backspace' ? 'Borrar último dígito' : key === '.' ? 'Punto decimal' : key
            }
            onClick={() => append(key)}
            className="flex h-12 items-center justify-center rounded-xl border border-border bg-bg text-xl font-semibold tabular-nums text-text transition hover:border-accent hover:bg-accent-soft active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40"
          >
            {key === 'backspace' ? '⌫' : key}
          </button>
        ))}
      </div>
    </div>
  );
}
