import type { Purchase, Supplier } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { PurchaseFormModal } from '../features/purchases/PurchaseFormModal';
import { usePurchases } from '../features/purchases/hooks';
import { SupplierFormModal } from '../features/suppliers/SupplierFormModal';
import { useSuppliers } from '../features/suppliers/hooks';

const UI_TEXT = {
  title: 'Proveedores y compras',
  newSupplier: 'Nuevo proveedor',
  newPurchase: 'Nueva compra',
  noActiveSuppliers: 'Registra un proveedor activo antes de capturar una compra',
  suppliersTitle: 'Proveedores',
  loadingSuppliers: 'Cargando proveedores…',
  errorSuppliers: 'No se pudieron cargar los proveedores.',
  emptySuppliers: 'Aún no hay proveedores.',
  colName: 'Nombre',
  colContact: 'Contacto',
  colPhone: 'Teléfono',
  colStatus: 'Estado',
  active: 'Activo',
  inactive: 'Inactivo',
  edit: 'Editar',
  purchasesTitle: 'Historial de compras',
  loadingPurchases: 'Cargando compras…',
  errorPurchases: 'No se pudieron cargar las compras.',
  emptyPurchases: 'Aún no hay compras registradas.',
  colDate: 'Fecha',
  colSupplier: 'Proveedor',
  colItems: 'Productos',
} as const;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function SuppliersTable({
  suppliers,
  onEdit,
}: {
  suppliers: Supplier[];
  onEdit: (supplierId: string) => void;
}): JSX.Element {
  if (suppliers.length === 0) {
    return <p className="text-sm text-muted">{UI_TEXT.emptySuppliers}</p>;
  }
  return (
    <table className="w-full border-collapse overflow-hidden rounded-2xl bg-surface text-left text-sm">
      <thead>
        <tr className="border-b border-border text-[12px] uppercase tracking-wide text-muted-2">
          <th className="px-4 py-3">{UI_TEXT.colName}</th>
          <th className="px-4 py-3">{UI_TEXT.colContact}</th>
          <th className="px-4 py-3">{UI_TEXT.colPhone}</th>
          <th className="px-4 py-3">{UI_TEXT.colStatus}</th>
          <th className="px-4 py-3" />
        </tr>
      </thead>
      <tbody>
        {suppliers.map((supplier) => (
          <tr key={supplier.id} className="border-b border-divider last:border-0">
            <td className="px-4 py-3 font-medium">{supplier.name}</td>
            <td className="px-4 py-3 text-muted">{supplier.contactName ?? '—'}</td>
            <td className="px-4 py-3 text-muted">{supplier.phone ?? '—'}</td>
            <td className="px-4 py-3">
              <span
                className={
                  supplier.isActive
                    ? 'rounded-full bg-green-100 px-2.5 py-1 text-[12px] font-semibold text-green-700'
                    : 'rounded-full bg-bg px-2.5 py-1 text-[12px] font-semibold text-muted-2'
                }
              >
                {supplier.isActive ? UI_TEXT.active : UI_TEXT.inactive}
              </span>
            </td>
            <td className="px-4 py-3 text-right">
              <button
                type="button"
                onClick={() => onEdit(supplier.id)}
                className="rounded-lg border border-border px-3 py-1.5 text-[13px] hover:border-border-hover"
              >
                {UI_TEXT.edit}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PurchasesTable({ purchases }: { purchases: Purchase[] }): JSX.Element {
  if (purchases.length === 0) {
    return <p className="text-sm text-muted">{UI_TEXT.emptyPurchases}</p>;
  }
  return (
    <table className="w-full border-collapse overflow-hidden rounded-2xl bg-surface text-left text-sm">
      <thead>
        <tr className="border-b border-border text-[12px] uppercase tracking-wide text-muted-2">
          <th className="px-4 py-3">{UI_TEXT.colDate}</th>
          <th className="px-4 py-3">{UI_TEXT.colSupplier}</th>
          <th className="px-4 py-3">{UI_TEXT.colItems}</th>
        </tr>
      </thead>
      <tbody>
        {purchases.map((purchase) => (
          <tr key={purchase.id} className="border-b border-divider last:border-0">
            <td className="px-4 py-3 text-muted">{formatDateTime(purchase.createdAt)}</td>
            <td className="px-4 py-3 font-medium">{purchase.supplierName}</td>
            <td className="px-4 py-3 text-muted">
              {purchase.lines.map((line) => `${line.quantity}x ${line.productName}`).join(', ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PageHeader({
  activeSuppliersCount,
  onNewSupplier,
  onNewPurchase,
}: {
  activeSuppliersCount: number;
  onNewSupplier: () => void;
  onNewPurchase: () => void;
}): JSX.Element {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-7 py-[18px]">
      <h1 className="m-0 text-[23px] font-bold tracking-tight">{UI_TEXT.title}</h1>
      <div className="ml-auto flex gap-2.5">
        <button
          type="button"
          onClick={onNewSupplier}
          className="h-11 rounded-lg border border-border px-4 text-[14px] hover:border-border-hover"
        >
          {UI_TEXT.newSupplier}
        </button>
        <button
          type="button"
          disabled={activeSuppliersCount === 0}
          onClick={onNewPurchase}
          title={activeSuppliersCount === 0 ? UI_TEXT.noActiveSuppliers : undefined}
          className="h-11 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {UI_TEXT.newPurchase}
        </button>
      </div>
    </header>
  );
}

function SuppliersSection({
  query,
  onEdit,
}: {
  query: ReturnType<typeof useSuppliers>;
  onEdit: (supplierId: string) => void;
}): JSX.Element {
  return (
    <>
      <h2 className="m-0 mb-3 text-[15px] font-semibold">{UI_TEXT.suppliersTitle}</h2>
      {query.isLoading ? <p className="text-sm text-muted">{UI_TEXT.loadingSuppliers}</p> : null}
      {query.isError ? <p className="text-sm text-red-600">{UI_TEXT.errorSuppliers}</p> : null}
      {query.data ? <SuppliersTable suppliers={query.data} onEdit={onEdit} /> : null}
    </>
  );
}

function PurchasesSection({ query }: { query: ReturnType<typeof usePurchases> }): JSX.Element {
  return (
    <>
      <h2 className="m-0 mb-3 mt-8 text-[15px] font-semibold">{UI_TEXT.purchasesTitle}</h2>
      {query.isLoading ? <p className="text-sm text-muted">{UI_TEXT.loadingPurchases}</p> : null}
      {query.isError ? <p className="text-sm text-red-600">{UI_TEXT.errorPurchases}</p> : null}
      {query.data ? <PurchasesTable purchases={query.data} /> : null}
    </>
  );
}

export function SuppliersPage(): JSX.Element {
  const suppliersQuery = useSuppliers();
  const purchasesQuery = usePurchases();
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [isCreatingPurchase, setIsCreatingPurchase] = useState(false);

  const editingSupplier = suppliersQuery.data?.find((supplier) => supplier.id === editingSupplierId);
  const activeSuppliers = (suppliersQuery.data ?? []).filter((supplier) => supplier.isActive);

  return (
    <AppShell>
      <PageHeader
        activeSuppliersCount={activeSuppliers.length}
        onNewSupplier={() => setIsCreatingSupplier(true)}
        onNewPurchase={() => setIsCreatingPurchase(true)}
      />

      <section className="flex-1 overflow-x-auto p-5">
        <SuppliersSection query={suppliersQuery} onEdit={setEditingSupplierId} />
        <PurchasesSection query={purchasesQuery} />
      </section>

      {isCreatingSupplier ? (
        <SupplierFormModal onClose={() => setIsCreatingSupplier(false)} />
      ) : null}
      {editingSupplier ? (
        <SupplierFormModal supplier={editingSupplier} onClose={() => setEditingSupplierId(null)} />
      ) : null}
      {isCreatingPurchase ? (
        <PurchaseFormModal suppliers={activeSuppliers} onClose={() => setIsCreatingPurchase(false)} />
      ) : null}
    </AppShell>
  );
}
