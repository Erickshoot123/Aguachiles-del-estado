import { useState } from 'react';
import type { BranchSummary } from '@aguachiles/shared';
import { useBranchReport } from '../features/branches/hooks';
import { BranchCard, formatMoney } from '../features/branches/BranchCard';
import { useLogout } from '../features/auth/useLogout';

function localDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function totalNet(branches: BranchSummary[]): string {
  // Suma en centavos enteros; solo se convierte a Number al formatear en pantalla.
  const cents = branches.reduce((sum, branch) => sum + BigInt(branch.netSales.replace('.', '')), 0n);
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function BranchesPage() {
  const [from, setFrom] = useState(localDate);
  const [to, setTo] = useState(localDate);
  const [selected, setSelected] = useState('');
  const query = useBranchReport({ from, to });
  const logout = useLogout();
  const all = query.data?.branches ?? [];
  const branches = selected ? all.filter((branch) => branch.id === selected) : all;
  return <main className="min-h-screen bg-bg p-4 text-text sm:p-8">
    <header className="mx-auto mb-6 flex max-w-6xl flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm text-muted">Aguachiles del Estado</p><h1 className="text-2xl font-bold">Ventas por sucursal</h1></div>
      <button onClick={logout} className="rounded-lg border border-border px-4 py-2">Cerrar sesión</button>
    </header>
    <section className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-sm">Desde<input aria-label="Desde" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="block rounded-lg border border-border p-2" /></label>
        <label className="text-sm">Hasta<input aria-label="Hasta" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="block rounded-lg border border-border p-2" /></label>
        <label className="text-sm">Sucursal<select aria-label="Sucursal" value={selected} onChange={(event) => setSelected(event.target.value)} className="block rounded-lg border border-border p-2">
          <option value="">Todas las sucursales</option>{all.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select></label>
        <button onClick={() => void query.refetch()} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Actualizar</button>
      </div>
      <p className="mb-4 text-sm text-muted">Cada sucursal usa su zona horaria. Las devoluciones se descuentan el día en que se realizan. Actualización cada 15 segundos.</p>
      {query.isLoading && <p role="status">Cargando ventas…</p>}
      {query.isError && <p role="alert" className="mb-4 text-red-700">No se pudo actualizar: {query.error.message}. Comprueba el periodo y tu acceso de administrador.</p>}
      {query.data && <><div className="mb-6 rounded-2xl bg-surface p-5">
        <p className="text-sm text-muted">Total neto recibido · {branches.length} {branches.length === 1 ? 'sucursal' : 'sucursales'}</p>
        <p className="font-mono text-3xl font-bold">{formatMoney(totalNet(branches))}</p>
        <p className="mt-2 text-xs text-muted">Los datos pueden estar incompletos si alguna sucursal tiene pendientes o no se ha actualizado.</p>
      </div><div className="grid gap-4 lg:grid-cols-2">{branches.map((branch) => <BranchCard key={branch.id} branch={branch} />)}</div>
        {!all.length && <p>Aún no hay sucursales registradas en la central.</p>}</>}
    </section>
  </main>;
}
