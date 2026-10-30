import type { JSX } from 'react';

const PREFERENCES = ['Sin pepino', 'Sin ajo', 'Sin pimienta'];

interface OrderPreferencesProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export function OrderPreferences({ selected, onChange, notes, onNotesChange }: OrderPreferencesProps): JSX.Element {
  return <fieldset className="rounded-lg border border-border p-3">
    <legend className="px-1 text-sm font-medium">Preferencias del cliente</legend>
    <div className="mb-3 flex flex-wrap gap-2">
      {PREFERENCES.map((preference) => <button key={preference} type="button"
        aria-pressed={selected.includes(preference)}
        onClick={() => onChange(selected.includes(preference)
          ? selected.filter((item) => item !== preference) : [...selected, preference])}
        className={`min-h-11 rounded-lg border px-3 text-sm ${selected.includes(preference)
          ? 'border-accent bg-accent text-white' : 'border-border bg-surface'}`}>
        {preference}
      </button>)}
    </div>
    <label className="flex flex-col gap-1 text-sm">Notas del pedido (opcional)
      <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} rows={2}
        placeholder="Otras indicaciones para cocina…" className="rounded-lg border border-border px-3 py-2" />
    </label>
  </fieldset>;
}
