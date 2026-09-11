import type { Product } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { useCategories, useCreateCategory, useCreateProduct, useUpdateProduct } from './hooks';

const UI_TEXT = {
  createTitle: 'Nuevo producto',
  editTitle: 'Editar producto',
  name: 'Nombre',
  sku: 'SKU',
  barcode: 'Código de barras (opcional)',
  description: 'Descripción (opcional)',
  category: 'Categoría',
  newCategory: 'Nueva categoría',
  addCategory: 'Agregar',
  price: 'Precio de venta',
  cost: 'Costo',
  taxRate: 'Impuesto (%)',
  unit: 'Unidad',
  initialStock: 'Stock inicial',
  isActive: 'Producto activo',
  isComplement: 'Es un extra/complemento (se ofrece al pedir un platillo principal)',
  cancel: 'Cancelar',
  save: 'Guardar',
  saving: 'Guardando…',
  error: 'No se pudo guardar el producto. Revisa que el SKU no esté repetido.',
} as const;

interface ProductFormModalProps {
  product?: Product;
  onClose: () => void;
}

interface FormState {
  sku: string;
  barcode: string;
  name: string;
  description: string;
  categoryId: string;
  price: string;
  cost: string;
  taxRate: string;
  unit: string;
  initialStock: string;
  isActive: boolean;
  isComplement: boolean;
}

function toFormState(product: Product | undefined): FormState {
  if (!product) {
    return {
      sku: '',
      barcode: '',
      name: '',
      description: '',
      categoryId: '',
      price: '',
      cost: '',
      taxRate: '0',
      unit: 'pieza',
      initialStock: '0',
      isActive: true,
      isComplement: false,
    };
  }
  return {
    sku: product.sku,
    barcode: product.barcode ?? '',
    name: product.name,
    description: product.description ?? '',
    categoryId: product.categoryId,
    price: String(product.price),
    cost: String(product.cost),
    taxRate: String(product.taxRate),
    unit: product.unit,
    initialStock: String(product.stock),
    isActive: product.isActive,
    isComplement: product.isComplement,
  };
}

export function ProductFormModal({ product, onClose }: ProductFormModalProps): JSX.Element {
  const categoriesQuery = useCategories();
  const createCategory = useCreateCategory();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const isEditing = Boolean(product);

  const [form, setForm] = useState<FormState>(() => toFormState(product));
  const [newCategoryName, setNewCategoryName] = useState('');

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddCategory = (): void => {
    if (!newCategoryName.trim()) return;
    createCategory.mutate(
      { name: newCategoryName.trim() },
      {
        onSuccess: (category) => {
          setField('categoryId', category.id);
          setNewCategoryName('');
        },
      },
    );
  };

  const isPending = createProduct.isPending || updateProduct.isPending;
  const hasError = createProduct.isError || updateProduct.isError;

  const handleSubmit = (): void => {
    const basePayload = {
      sku: form.sku,
      barcode: form.barcode.trim() === '' ? null : form.barcode.trim(),
      name: form.name,
      description: form.description.trim() === '' ? null : form.description.trim(),
      categoryId: form.categoryId,
      price: Number(form.price),
      cost: Number(form.cost),
      taxRate: Number(form.taxRate),
      unit: form.unit,
      isComplement: form.isComplement,
    };

    if (isEditing && product) {
      updateProduct.mutate(
        { productId: product.id, input: { ...basePayload, isActive: form.isActive } },
        { onSuccess: onClose },
      );
      return;
    }

    createProduct.mutate(
      { ...basePayload, initialStock: Number(form.initialStock) },
      { onSuccess: onClose },
    );
  };

  const canSubmit =
    form.sku.trim() !== '' &&
    form.name.trim() !== '' &&
    form.categoryId !== '' &&
    form.price !== '' &&
    form.cost !== '' &&
    form.unit.trim() !== '';

  return (
    <ModalBackdrop
      onClose={onClose}
      contentClassName="flex w-full max-w-md flex-col rounded-2xl bg-surface"
    >
      <div className="border-b border-divider px-5 py-4">
        <h2 className="m-0 text-[17px] font-semibold">
          {isEditing ? UI_TEXT.editTitle : UI_TEXT.createTitle}
        </h2>
      </div>

      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {UI_TEXT.name}
            <input
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {UI_TEXT.sku}
            <input
              value={form.sku}
              onChange={(event) => setField('sku', event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          {UI_TEXT.barcode}
          <input
            value={form.barcode}
            onChange={(event) => setField('barcode', event.target.value)}
            className="rounded-lg border border-border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {UI_TEXT.description}
          <textarea
            value={form.description}
            onChange={(event) => setField('description', event.target.value)}
            rows={2}
            className="rounded-lg border border-border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {UI_TEXT.category}
          <select
            value={form.categoryId}
            onChange={(event) => setField('categoryId', event.target.value)}
            className="rounded-lg border border-border px-3 py-2"
          >
            <option value="" disabled>
              —
            </option>
            {(categoriesQuery.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            {UI_TEXT.newCategory}
            <input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={handleAddCategory}
            disabled={createCategory.isPending}
            className="h-[42px] rounded-lg border border-border px-3 text-sm hover:border-border-hover"
          >
            {UI_TEXT.addCategory}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {UI_TEXT.price}
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(event) => setField('price', event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {UI_TEXT.cost}
            <input
              type="number"
              min={0}
              value={form.cost}
              onChange={(event) => setField('cost', event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {UI_TEXT.taxRate}
            <input
              type="number"
              min={0}
              value={form.taxRate}
              onChange={(event) => setField('taxRate', event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {UI_TEXT.unit}
            <input
              value={form.unit}
              onChange={(event) => setField('unit', event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
          {!isEditing ? (
            <label className="flex flex-col gap-1 text-sm">
              {UI_TEXT.initialStock}
              <input
                type="number"
                min={0}
                value={form.initialStock}
                onChange={(event) => setField('initialStock', event.target.value)}
                className="rounded-lg border border-border px-3 py-2"
              />
            </label>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isComplement}
            onChange={(event) => setField('isComplement', event.target.checked)}
          />
          {UI_TEXT.isComplement}
        </label>

        {isEditing ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setField('isActive', event.target.checked)}
            />
            {UI_TEXT.isActive}
          </label>
        ) : null}

        {hasError ? <p className="text-sm text-red-600">{UI_TEXT.error}</p> : null}
      </div>

      <div className="flex gap-2.5 bg-bg px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-lg border border-border px-4 text-[14px]"
        >
          {UI_TEXT.cancel}
        </button>
        <button
          type="button"
          disabled={!canSubmit || isPending}
          onClick={handleSubmit}
          className="ml-auto h-11 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {isPending ? UI_TEXT.saving : UI_TEXT.save}
        </button>
      </div>
    </ModalBackdrop>
  );
}
