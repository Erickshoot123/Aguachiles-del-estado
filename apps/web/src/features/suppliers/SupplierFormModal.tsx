import type { Supplier } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { useCreateSupplier, useUpdateSupplier } from './hooks';

const UI_TEXT = {
  createTitle: 'Nuevo proveedor',
  editTitle: 'Editar proveedor',
  name: 'Nombre',
  contactName: 'Contacto (opcional)',
  phone: 'Teléfono (opcional)',
  email: 'Correo (opcional)',
  taxId: 'RFC (opcional)',
  isActive: 'Proveedor activo',
  cancel: 'Cancelar',
  save: 'Guardar',
  saving: 'Guardando…',
  error: 'No se pudo guardar el proveedor.',
} as const;

interface SupplierFormModalProps {
  supplier?: Supplier;
  onClose: () => void;
}

interface FormState {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  taxId: string;
  isActive: boolean;
}

function toFormState(supplier: Supplier | undefined): FormState {
  return {
    name: supplier?.name ?? '',
    contactName: supplier?.contactName ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    taxId: supplier?.taxId ?? '',
    isActive: supplier?.isActive ?? true,
  };
}

function toNullableField(value: string): string | null {
  return value.trim() === '' ? null : value.trim();
}

export function SupplierFormModal({ supplier, onClose }: SupplierFormModalProps): JSX.Element {
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const isEditing = Boolean(supplier);

  const [form, setForm] = useState<FormState>(() => toFormState(supplier));

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isPending = createSupplier.isPending || updateSupplier.isPending;
  const hasError = createSupplier.isError || updateSupplier.isError;

  const handleSubmit = (): void => {
    const payload = {
      name: form.name,
      contactName: toNullableField(form.contactName),
      phone: toNullableField(form.phone),
      email: toNullableField(form.email),
      taxId: toNullableField(form.taxId),
    };

    if (isEditing && supplier) {
      updateSupplier.mutate(
        { supplierId: supplier.id, input: { ...payload, isActive: form.isActive } },
        { onSuccess: onClose },
      );
      return;
    }

    createSupplier.mutate(payload, { onSuccess: onClose });
  };

  const canSubmit = form.name.trim() !== '';

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

      <div className="flex flex-col gap-3 px-5 py-4">
        <label className="flex flex-col gap-1 text-sm">
          {UI_TEXT.name}
          <input
            value={form.name}
            onChange={(event) => setField('name', event.target.value)}
            className="rounded-lg border border-border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {UI_TEXT.contactName}
          <input
            value={form.contactName}
            onChange={(event) => setField('contactName', event.target.value)}
            className="rounded-lg border border-border px-3 py-2"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {UI_TEXT.phone}
            <input
              value={form.phone}
              onChange={(event) => setField('phone', event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {UI_TEXT.email}
            <input
              type="email"
              value={form.email}
              onChange={(event) => setField('email', event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          {UI_TEXT.taxId}
          <input
            value={form.taxId}
            onChange={(event) => setField('taxId', event.target.value)}
            className="rounded-lg border border-border px-3 py-2"
          />
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
