import type { PlateSize, Product } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { ApiError } from '../../lib/apiClient';
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
  taxRate: 'Impuesto (%)',
  unit: 'Unidad',
  isActive: 'Producto activo',
  isComplement: 'Es un extra/complemento (se ofrece al pedir un platillo principal)',
  cancel: 'Cancelar',
  save: 'Guardar',
  saving: 'Guardando…',
  error: 'No se pudo guardar el producto.',
} as const;

interface ProductFormModalProps {
  product?: Product;
  onClose: () => void;
}

interface FormState {
  plateSize: PlateSize | '';
  sku: string;
  barcode: string;
  name: string;
  description: string;
  categoryId: string;
  price: string;
  taxRate: string;
  unit: string;
  isActive: boolean;
  isComplement: boolean;
}

function toFormState(product: Product | undefined): FormState {
  if (!product) {
    return {
      plateSize: '',
      sku: '',
      barcode: '',
      name: '',
      description: '',
      categoryId: '',
      price: '',
      taxRate: '0',
      unit: 'pieza',
      isActive: true,
      isComplement: false,
    };
  }
  return {
    plateSize: product.plateSize ?? '',
    sku: product.sku,
    barcode: product.barcode ?? '',
    name: product.name,
    description: product.description ?? '',
    categoryId: product.categoryId,
    price: String(product.price),
    taxRate: String(product.taxRate),
    unit: product.unit,
    isActive: product.isActive,
    isComplement: product.isComplement,
  };
}

function plateSizeForUnit(unit: string): PlateSize | null {
  switch (unit.toLowerCase().replace(/\s+/g, '')) {
    case '1kilo':
    case 'kilo':
    case '1kg':
      return 'kilo';
    case '1/2kilo':
    case 'mediokilo':
    case '1/2kg':
    case '½kilo':
    case '½kg':
      return 'half_kilo';
    default:
      return null;
  }
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
  const productError = createProduct.error ?? updateProduct.error;
  const selectedCategory = categoriesQuery.data?.find(
    (category) => category.id === form.categoryId,
  );

  const handleSubmit = (): void => {
    const basePayload = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      price: Number(form.price),
      unit: form.unit.trim(),
    };

    if (product) {
      updateProduct.mutate(
        {
          productId: product.id,
          input: {
            ...basePayload,
            sku: form.sku.trim(),
            barcode: form.barcode.trim() || null,
            description: form.description.trim() || null,
            taxRate: Number(form.taxRate),
            plateSize: form.isComplement ? null : form.plateSize || null,
            isComplement: form.isComplement,
            isActive: form.isActive,
          },
        },
        { onSuccess: onClose },
      );
      return;
    }

    const categoryName = selectedCategory?.name.trim().toLowerCase();
    createProduct.mutate(
      {
        ...basePayload,
        cost: 0,
        taxRate: 0,
        initialStock: 0,
        isComplement: categoryName === 'extras' || categoryName === 'complementos',
        plateSize: categoryName === 'aguachiles' ? plateSizeForUnit(basePayload.unit) : null,
      },
      { onSuccess: onClose },
    );
  };

  const canSubmit =
    (!isEditing || form.sku.trim() !== '') &&
    form.name.trim() !== '' &&
    selectedCategory !== undefined &&
    form.price !== '' &&
    Number.isFinite(Number(form.price)) &&
    Number(form.price) >= 0 &&
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
        <div className={isEditing ? 'grid grid-cols-2 gap-3' : undefined}>
          <label className="flex flex-col gap-1 text-sm">
            {UI_TEXT.name}
            <input
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
          {isEditing ? (
            <label className="flex flex-col gap-1 text-sm">
              {UI_TEXT.sku}
              <input
                value={form.sku}
                onChange={(event) => setField('sku', event.target.value)}
                className="rounded-lg border border-border px-3 py-2"
              />
            </label>
          ) : null}
        </div>

        {isEditing ? (
          <label className="flex flex-col gap-1 text-sm">
            {UI_TEXT.barcode}
            <input
              value={form.barcode}
              onChange={(event) => setField('barcode', event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
        ) : null}

        {isEditing ? (
          <label className="flex flex-col gap-1 text-sm">
            {UI_TEXT.description}
            <textarea
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
              rows={2}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
        ) : null}

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
            disabled={createCategory.isPending || !newCategoryName.trim()}
            className="h-[42px] rounded-lg border border-border px-3 text-sm hover:border-border-hover"
          >
            {UI_TEXT.addCategory}
          </button>
        </div>
        {createCategory.isError ? (
          <p role="alert" className="text-sm text-red-600">
            {createCategory.error instanceof ApiError
              ? createCategory.error.message
              : 'No se pudo crear la categoría.'}
          </p>
        ) : null}

        <div className={isEditing ? 'grid grid-cols-2 gap-3' : undefined}>
          <label className="flex flex-col gap-1 text-sm">
            {UI_TEXT.price}
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.price}
              onChange={(event) => setField('price', event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
          {isEditing ? (
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
          ) : null}
        </div>

        <label className="flex flex-col gap-1 text-sm">
          {UI_TEXT.unit}
          <input
            value={form.unit}
            list="product-unit-options"
            onChange={(event) => setField('unit', event.target.value)}
            className="rounded-lg border border-border px-3 py-2"
          />
          <datalist id="product-unit-options">
            <option value="pieza" />
            <option value="1 kilo" />
            <option value="1/2 kilo" />
          </datalist>
        </label>

        {isEditing ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isComplement}
              onChange={(event) => setField('isComplement', event.target.checked)}
            />
            {UI_TEXT.isComplement}
          </label>
        ) : null}

        {isEditing && !form.isComplement ? (
          <label className="flex flex-col gap-1 text-sm">
            Presentación para conteo de platos
            <select
              value={form.plateSize}
              onChange={(event) => setField('plateSize', event.target.value as PlateSize | '')}
              className="rounded-lg border border-border px-3 py-2"
            >
              <option value="">No usa platos de kilo ni medio kilo</option>
              <option value="kilo">1 kilo</option>
              <option value="half_kilo">1/2 kilo</option>
            </select>
          </label>
        ) : null}
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

        {productError ? (
          <p role="alert" className="text-sm text-red-600">
            {productError instanceof ApiError ? productError.message : UI_TEXT.error}
          </p>
        ) : null}
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
