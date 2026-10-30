import { useSyncStatus } from './hooks';

export function SyncStatusBanner() {
  const query = useSyncStatus();
  if (query.isError) return <div role="status" className="border-b border-border px-5 py-2 text-sm text-red-700">
    No se pudo consultar el estado de la sucursal.</div>;
  const status = query.data;
  if (!status || status.mode !== 'local') return null;
  const message = !status.enabled ? 'Sincronización central sin configurar' : status.lastError ? status.lastError :
    status.pendingCount ? `${status.pendingCount} movimientos pendientes de enviar` :
    status.lastSuccessAt ? 'Sincronización al día' : 'Esperando primera sincronización';
  return <div role="status" className="flex flex-wrap gap-x-4 border-b border-border bg-surface px-5 py-2 text-sm">
    <strong>{status.locationName}</strong><span>{message}</span>
    {status.lastSuccessAt && <span className="text-muted">Último envío: {new Date(status.lastSuccessAt).toLocaleString('es-MX')}</span>}
  </div>;
}
