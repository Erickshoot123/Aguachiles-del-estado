import type { JSX } from 'react';

export interface PortionPreferencesValue {
  excluded: string[];
  garlic: string;
  salt: string;
  pepper: string;
  extraSpicy: boolean;
}

export const emptyPortionPreferences = (): PortionPreferencesValue => ({
  excluded: [], garlic: 'Normal', salt: 'Normal', pepper: 'Normal', extraSpicy: false,
});

export function describePortion(value: PortionPreferencesValue): string | undefined {
  const notes = value.excluded.map((ingredient) => `Sin ${ingredient}`);
  for (const [label, amount] of [['ajo', value.garlic], ['sal', value.salt], ['pimienta', value.pepper]]) {
    if (amount !== 'Normal') notes.push(`${amount} ${label}`);
  }
  if (value.extraSpicy) notes.push('Extra picante');
  return notes.join(' · ') || undefined;
}

interface PortionPreferencesProps {
  label: string;
  value: PortionPreferencesValue;
  onChange: (value: PortionPreferencesValue) => void;
}

export function PortionPreferences({ label, value, onChange }: PortionPreferencesProps): JSX.Element {
  return <fieldset className="rounded-lg border border-border p-2">
    <legend className="px-1 text-sm font-semibold">{label}</legend>
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {['cebolla', 'pepino', 'aguacate'].map((ingredient) => <label key={ingredient} className="flex min-h-9 items-center gap-2">
        <input type="checkbox" checked={value.excluded.includes(ingredient)}
          onChange={(event) => onChange({ ...value, excluded: event.target.checked
            ? [...value.excluded, ingredient] : value.excluded.filter((item) => item !== ingredient) })} />
        Sin {ingredient}
      </label>)}
      <label className="flex min-h-9 items-center gap-2">
        <input type="checkbox" checked={value.extraSpicy} onChange={(event) => onChange({ ...value, extraSpicy: event.target.checked })} />
        Extra picante
      </label>
    </div>
    <div className="mt-2 grid grid-cols-3 gap-2">
      {([['garlic', 'Ajo'], ['salt', 'Sal'], ['pepper', 'Pimienta']] as const).map(([key, title]) => <label key={key} className="text-xs">{title}
        <select aria-label={title} value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })}
          className="mt-1 block min-h-10 w-full rounded border border-border bg-surface px-2 text-sm">
          {['Normal', 'Sin', 'Poco', 'Extra'].map((amount) => <option key={amount}>{amount}</option>)}
        </select>
      </label>)}
    </div>
  </fieldset>;
}
