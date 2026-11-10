import { zodResolver } from '@hookform/resolvers/zod';
import { createUserRequestSchema } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { ApiError } from '../../lib/apiClient';
import { useCreateUser } from './hooks';

const formSchema = createUserRequestSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((input) => input.initialPassword === input.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  });
type FormValues = z.infer<typeof formSchema>;

const inputClassName = 'h-11 rounded-lg border border-border px-3';
const fields = [
  { name: 'name', label: 'Nombre', type: 'text', autoComplete: 'off' },
  { name: 'username', label: 'Usuario', type: 'text', autoComplete: 'off' },
  {
    name: 'initialPassword',
    label: 'Contraseña inicial',
    type: 'password',
    autoComplete: 'new-password',
  },
  {
    name: 'confirmPassword',
    label: 'Confirmar contraseña',
    type: 'password',
    autoComplete: 'new-password',
  },
] as const;

export function NewUserModal({ onClose }: { onClose: () => void }): JSX.Element {
  const create = useCreateUser();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { roleName: 'cajero' },
  });
  const onSubmit = handleSubmit(({ name, username, roleName, initialPassword }) => {
    create.mutate({ name, username, roleName, initialPassword }, { onSuccess: onClose });
  });

  return (
    <ModalBackdrop
      onClose={onClose}
      contentClassName="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-surface"
    >
      <form onSubmit={onSubmit}>
        <header className="border-b border-divider px-5 py-4">
          <h2 className="text-xl font-semibold">Nuevo usuario</h2>
          <p className="mt-1 text-sm text-muted">
            La persona cambiará la contraseña inicial cuando entre por primera vez.
          </p>
        </header>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {fields.map(({ name, label, type, autoComplete }) => (
            <label key={name} className="flex flex-col gap-1 text-sm">
              {label}
              <input
                type={type}
                autoComplete={autoComplete}
                className={inputClassName}
                aria-invalid={Boolean(errors[name])}
                {...register(name)}
              />
              {errors[name] ? <span className="text-red-700">{errors[name]?.message}</span> : null}
            </label>
          ))}
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Rol
            <select className={inputClassName} {...register('roleName')}>
              <option value="cajero">Cajero</option>
              <option value="gerente">Gerente</option>
            </select>
          </label>
          {create.isError ? (
            <p role="alert" className="text-sm text-red-700 sm:col-span-2">
              {create.error instanceof ApiError
                ? create.error.message
                : 'No se pudo crear la cuenta.'}
            </p>
          ) : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-divider bg-bg px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg border border-border px-4 text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {create.isPending ? 'Guardando…' : 'Crear usuario'}
          </button>
        </footer>
      </form>
    </ModalBackdrop>
  );
}
