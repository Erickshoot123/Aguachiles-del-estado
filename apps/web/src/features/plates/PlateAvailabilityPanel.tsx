import { useState, type JSX, type FormEvent } from 'react';
import { usePermission } from '../auth/authStore';
import { usePlateAvailability, useSavePlates } from './hooks';
import { ApiError } from '../../lib/apiClient';

export function PlateAvailabilityPanel(): JSX.Element {
  const query = usePlateAvailability();
  const [editing, setEditing] = useState(false);
  const [kilo, setKilo] = useState('');
  const [half, setHalf] = useState('');
  const [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const initial = !query.data?.initialized;
  const save = useSavePlates(initial);
  const canAdjust = usePermission('catalog.write');
  const showForm = initial || editing;
  const validCounts = kilo !== '' && half !== '' && Number.isInteger(Number(kilo)) && Number.isInteger(Number(half))
    && Math.abs(Number(kilo)) <= 100000 && Math.abs(Number(half)) <= 100000;
  const valid = validCounts && (initial ? Number(kilo) >= 0 && Number(half) >= 0
    : reason.trim() !== '' && (Number(kilo) !== 0 || Number(half) !== 0));
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!valid) return;
    save.mutate(initial ? { kilo: Number(kilo), halfKilo: Number(half) }
      : { requestId, kiloDelta: Number(kilo), halfKiloDelta: Number(half), reason }, {
      onSuccess: () => { setEditing(false); setKilo(''); setHalf(''); setReason(''); },
    });
  };
  return <section className="border-b border-border bg-surface px-5 py-4" aria-label="Disponibilidad de platos">
    <h2 className="font-semibold">Platos de hoy {query.data?.date}</h2>
    {query.isLoading ? <p>Cargando disponibilidad…</p> : null}
    {query.isError ? <p role="alert">No se pudo consultar la disponibilidad. Intenta actualizar.</p> : null}
    {query.data ? <>
      {!initial ? <div className="my-2 grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
        {query.data.buckets.map((bucket) => <div key={bucket.size} className="rounded-lg border border-border p-3">
          <strong>{bucket.size === 'kilo' ? '1 kilo' : '1/2 kilo'}: {bucket.available} disponibles</strong>
          <p className="text-sm text-muted">{bucket.sold} vendidos · {bucket.reserved} en pedidos pendientes · {bucket.limit} habilitados</p>
        </div>)}
      {canAdjust && !initial && !editing ? <button type="button" className="rounded bg-accent px-3 py-2 font-semibold text-white hover:bg-accent-hover"
        onClick={() => { setKilo('0'); setHalf('0'); setRequestId(crypto.randomUUID()); save.reset(); setEditing(true); }}>Ajustar platos</button> : null}
      </div> : <p className="my-2 text-sm">Antes de vender, registra cuántos platos de cada presentación tienes disponibles.</p>}

      {showForm ? <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">{initial ? 'Platos iniciales de 1 kilo' : 'Agregar/quitar platos de 1 kilo'}
          <input type="number" min={initial ? 0 : -100000} max="100000" step="1" required value={kilo}
            onChange={(event) => setKilo(event.target.value)} className="mt-1 block w-36 rounded border border-border px-3 py-2" />
        </label>
        <label className="text-sm">{initial ? 'Platos iniciales de 1/2 kilo' : 'Agregar/quitar platos de 1/2 kilo'}
          <input type="number" min={initial ? 0 : -100000} max="100000" step="1" required value={half}
            onChange={(event) => setHalf(event.target.value)} className="mt-1 block w-36 rounded border border-border px-3 py-2" />
        </label>
        {!initial ? <label className="text-sm">Motivo del ajuste
          <input required maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)}
            className="mt-1 block rounded border border-border px-3 py-2" placeholder="Compra adicional, merma…" />
        </label> : null}
        <button disabled={!valid || save.isPending} className="rounded bg-accent px-4 py-2 text-white disabled:opacity-50">
          {save.isPending ? 'Guardando…' : initial ? 'Registrar platos iniciales' : 'Guardar ajuste'}
        </button>
        {!initial ? <button type="button" onClick={() => setEditing(false)}>Cancelar ajuste</button> : null}
        {!initial ? <p className="w-full text-xs text-muted">Usa cantidades positivas para agregar producción y negativas para quitar disponibilidad.</p> : null}
      </form> : null}
      {save.isError && showForm ? <p role="alert" className="mt-2 text-sm text-red-600">
        {save.error instanceof ApiError ? save.error.message : 'No se confirmó el cambio. Actualiza antes de volver a ajustar.'}
      </p> : null}
    </> : null}
  </section>;
}
