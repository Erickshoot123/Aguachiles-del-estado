import type { JSX } from 'react';
import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { formatCurrency } from '../features/orders/channelLabels';
import { useCatalogProducts } from '../features/catalog/hooks';
import { ProductFormModal } from '../features/catalog/ProductFormModal';

const UI_TEXT = {
  title: 'Menú y productos',
  newProduct: 'Nuevo producto',
  loading: 'Cargando menú…',
  error: 'No se pudo cargar el menú.',
  empty: 'Aún no hay productos.',
  colName: 'Producto',
  colCategory: 'Categoría',
  colPrice: 'Precio',
  colCost: 'Costo',
  colStock: 'Stock',
  colStatus: 'Estado',
  active: 'Activo',
  inactive: 'Inactivo',
  edit: 'Editar',
} as const;

export function CatalogPage(): JSX.Element {
  const productsQuery = useCatalogProducts();
  const [isCreating, setIsCreating] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const editingProduct = productsQuery.data?.find((product) => product.id === editingProductId);

  return (
    <AppShell>
      <header className="flex flex-wrap items-center gap-6 border-b border-border bg-surface px-7 py-[18px]">
        <h1 className="m-0 text-[23px] font-bold tracking-tight">{UI_TEXT.title}</h1>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="ml-auto h-11 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover"
        >
          {UI_TEXT.newProduct}
        </button>
      </header>

      <section className="flex-1 overflow-x-auto p-5">
        {productsQuery.isLoading ? <p className="text-sm text-muted">{UI_TEXT.loading}</p> : null}
        {productsQuery.isError ? <p className="text-sm text-red-600">{UI_TEXT.error}</p> : null}

        {productsQuery.data ? (
          productsQuery.data.length === 0 ? (
            <p className="text-sm text-muted">{UI_TEXT.empty}</p>
          ) : (
            <table className="w-full border-collapse overflow-hidden rounded-2xl bg-surface text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[12px] uppercase tracking-wide text-muted-2">
                  <th className="px-4 py-3">{UI_TEXT.colName}</th>
                  <th className="px-4 py-3">{UI_TEXT.colCategory}</th>
                  <th className="px-4 py-3">{UI_TEXT.colPrice}</th>
                  <th className="px-4 py-3">{UI_TEXT.colCost}</th>
                  <th className="px-4 py-3">{UI_TEXT.colStock}</th>
                  <th className="px-4 py-3">{UI_TEXT.colStatus}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {productsQuery.data.map((product) => (
                  <tr key={product.id} className="border-b border-divider last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{product.name}</div>
                      <div className="font-mono text-[12px] text-muted-2">{product.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-muted">{product.categoryName}</td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(product.price)}</td>
                    <td className="px-4 py-3 font-mono text-muted">
                      {formatCurrency(product.cost)}
                    </td>
                    <td className="px-4 py-3 font-mono">{product.stock}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          product.isActive
                            ? 'rounded-full bg-green-100 px-2.5 py-1 text-[12px] font-semibold text-green-700'
                            : 'rounded-full bg-bg px-2.5 py-1 text-[12px] font-semibold text-muted-2'
                        }
                      >
                        {product.isActive ? UI_TEXT.active : UI_TEXT.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingProductId(product.id)}
                        className="rounded-lg border border-border px-3 py-1.5 text-[13px] hover:border-border-hover"
                      >
                        {UI_TEXT.edit}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </section>

      {isCreating ? <ProductFormModal onClose={() => setIsCreating(false)} /> : null}
      {editingProduct ? (
        <ProductFormModal product={editingProduct} onClose={() => setEditingProductId(null)} />
      ) : null}
    </AppShell>
  );
}
