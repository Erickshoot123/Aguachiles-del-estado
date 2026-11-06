import { useState, type JSX } from 'react';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '../components/AppShell';
import { ModalBackdrop } from '../components/ModalBackdrop';
import { getUpdateStatus, updateAction, type UpdateStatus } from '../features/updates/api';
import { useOfflineQueueStore } from '../features/orders/offlineQueue';
import { useKitchenQueue } from '../features/receipts/kitchenPrinting';

const active = (phase?: string) => ['checking', 'downloading', 'installing'].includes(phase ?? '');
export function UpdatesPage(): JSX.Element {
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const pendingOrders = useOfflineQueueStore((state) => state.queue.length);
  const pendingPrints = useKitchenQueue((state) => state.jobs.length + state.busy.length);
  const otherActions = useIsMutating({
    predicate: (mutation) => mutation.options.mutationKey?.[0] !== 'manual-updates',
  });
  const query = useQuery({
    queryKey: ['manual-updates'],
    queryFn: getUpdateStatus,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (item) => (active(item.state.data?.phase) ? 1500 : false),
  });
  const action = useMutation({
    mutationKey: ['manual-updates'],
    mutationFn: (value: 'check' | 'download' | 'install') =>
      updateAction(value, value === 'install'),
    onSuccess: (state: UpdateStatus) => {
      client.setQueryData(['manual-updates'], state);
      setConfirm(false);
    },
  });
  const state = query.data;
  const unavailable = !state || ['unavailable', 'unconfigured'].includes(state.phase);
  const busy = action.isPending || active(state?.phase);
  const unsafe = pendingOrders > 0 || pendingPrints > 0 || otherActions > 0;
  return (
    <AppShell>
      <header className="border-b border-border bg-surface px-6 py-4">
        <h1 className="text-2xl font-bold">Actualizaciones</h1>
        <p className="mt-1 text-sm text-muted">Tú decides cuándo buscar, descargar e instalar.</p>
      </header>
      <section className="flex-1 space-y-5 overflow-auto p-6">
        <div className="max-w-3xl rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm text-muted">Versión instalada</p>
          <strong className="text-2xl">{state?.installedVersion ?? 'No disponible'}</strong>
          <p className="my-4 text-sm text-muted">
            Buscar actualizaciones consulta GitHub solo cuando pulses el botón. Descargar no detiene
            el POS ni instala nada. La instalación cierra y reinicia el programa.
          </p>
          {query.isLoading ? <p>Cargando estado local…</p> : null}
          {query.isError ? (
            <p role="alert" className="mb-3 text-sm text-red-700">
              No se pudo consultar el servicio local.{' '}
              <button
                className="underline"
                onClick={() => {
                  void query.refetch();
                }}
              >
                Reintentar
              </button>
            </p>
          ) : null}
          <button
            type="button"
            disabled={unavailable || busy}
            onClick={() => action.mutate('check')}
            className="rounded-lg bg-accent px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {state?.phase === 'checking' ? 'Buscando…' : 'Buscar actualizaciones'}
          </button>
          {state?.checkedAt ? (
            <p className="mt-3 text-xs text-muted">
              Última búsqueda: {new Date(state.checkedAt).toLocaleString('es-MX')}
            </p>
          ) : null}
        </div>
        {state?.message ? (
          <p
            role={state.phase === 'error' ? 'alert' : 'status'}
            className="max-w-3xl rounded-xl border border-border bg-surface p-4 text-sm"
          >
            {state.message}
          </p>
        ) : null}
        {action.isError ? (
          <p role="alert" className="max-w-3xl text-sm text-red-700">
            {action.error.message}
          </p>
        ) : null}
        {state?.availableVersion ? (
          <div className="max-w-3xl rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-lg font-semibold">Versión {state.availableVersion}</h2>
            <p className="mt-1 text-sm text-muted">
              Descarga: {((state.bytes ?? 0) / 1048576).toFixed(1)} MB · Windows de 64 bits
            </p>
            <p className="my-4 whitespace-pre-wrap text-sm">
              {state.releaseNotes || 'Mejoras del POS.'}
            </p>
            {state.phase === 'downloading' ? (
              <div role="status">
                <label className="text-sm">
                  Descargando: {state.progress ?? 0}%
                  <progress
                    aria-label="Progreso de descarga"
                    value={state.progress ?? 0}
                    max={100}
                    className="mt-2 block h-3 w-full accent-orange-600"
                  />
                </label>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              {['available', 'error'].includes(state.phase) ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => action.mutate('download')}
                  className="rounded-lg border border-accent px-4 py-3 font-semibold text-accent-hover disabled:opacity-50"
                >
                  Descargar versión
                </button>
              ) : null}
              {state.phase === 'ready' ? (
                <button
                  type="button"
                  disabled={busy || unsafe}
                  onClick={() => setConfirm(true)}
                  className="rounded-lg bg-accent px-4 py-3 font-semibold text-white disabled:opacity-50"
                >
                  Instalar y reiniciar POS
                </button>
              ) : null}
            </div>
            {state.phase === 'ready' && unsafe ? (
              <p role="alert" className="mt-3 text-sm text-amber-800">
                Termina los movimientos, sincroniza los pedidos pendientes y revisa las impresiones
                sin confirmar antes de instalar.
              </p>
            ) : null}
            {state.phase === 'installing' ? (
              <p role="status" className="mt-3 font-semibold">
                Preparando respaldo e instalación. El POS se cerrará y abrirá nuevamente. No apagues
                la computadora.
              </p>
            ) : null}
          </div>
        ) : null}
        <p className="max-w-3xl text-sm text-muted">
          Antes de instalar, cierra las cajas de la sucursal. La base de datos, la configuración de
          impresora y los respaldos se conservan.
        </p>
      </section>
      {confirm ? (
        <ModalBackdrop
          onClose={() => {
            if (!action.isPending) setConfirm(false);
          }}
          contentClassName="w-full max-w-md rounded-2xl bg-surface p-5"
        >
          <h2 className="text-lg font-semibold">¿Instalar la actualización ahora?</h2>
          <p className="my-4 text-sm">
            Se comprobará que las cajas estén cerradas, se hará un respaldo y se cerrará el POS para
            instalar la versión {state?.availableVersion}. Realízalo cuando el negocio pueda detener
            la operación.
          </p>
          {action.isError ? (
            <p role="alert" className="mb-3 text-sm text-red-700">
              {action.error.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              disabled={action.isPending}
              onClick={() => setConfirm(false)}
              className="rounded-lg border border-border px-4 py-2"
            >
              Ahora no
            </button>
            <button
              disabled={action.isPending || unsafe}
              onClick={() => action.mutate('install')}
              className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {action.isPending ? 'Comprobando…' : 'Confirmar instalación'}
            </button>
          </div>
        </ModalBackdrop>
      ) : null}
    </AppShell>
  );
}
