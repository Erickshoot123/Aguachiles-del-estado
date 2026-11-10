import { changePasswordRequestSchema, type ChangePasswordRequest } from '@aguachiles/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import type { JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '../../lib/apiClient';
import { authFetch } from '../../lib/authFetch';
import { useAuthStore } from './authStore';
import { useLogout } from './useLogout';

const formSchema = changePasswordRequestSchema
  .extend({ confirmPassword: z.string() })
  .refine((input) => input.newPassword === input.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  });
type FormValues = z.infer<typeof formSchema>;

const fields = [
  { name: 'currentPassword', label: 'Contraseña inicial', autoComplete: 'current-password' },
  { name: 'newPassword', label: 'Nueva contraseña', autoComplete: 'new-password' },
  { name: 'confirmPassword', label: 'Confirmar nueva contraseña', autoComplete: 'new-password' },
] as const;

export function InitialPasswordPage(): JSX.Element {
  const clearSession = useAuthStore((state) => state.clearSession);
  const logout = useLogout();
  const navigate = useNavigate();
  const change = useMutation({
    mutationFn: (input: ChangePasswordRequest) =>
      authFetch<void>('/api/auth/change-password', { method: 'POST', body: input }),
    gcTime: 0,
    onSuccess: () => {
      clearSession({ passwordChanged: true });
      navigate('/login', { replace: true });
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });
  const onSubmit = handleSubmit(({ currentPassword, newPassword }) =>
    change.mutate({ currentPassword, newPassword }),
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
      >
        <div>
          <h1 className="text-xl font-bold">Cambia tu contraseña inicial</h1>
          <p className="mt-1 text-sm text-muted">
            Elige tu propia contraseña de al menos 6 caracteres para empezar a usar el POS.
          </p>
        </div>
        {fields.map(({ name, label, autoComplete }) => (
          <label key={name} className="flex flex-col gap-1 text-sm">
            {label}
            <input
              type="password"
              autoComplete={autoComplete}
              className="h-11 rounded-lg border border-border px-3"
              aria-invalid={Boolean(errors[name])}
              {...register(name)}
            />
            {errors[name] ? <span className="text-red-700">{errors[name]?.message}</span> : null}
          </label>
        ))}
        {change.isError ? (
          <p role="alert" className="text-sm text-red-700">
            {change.error instanceof ApiError
              ? change.error.message
              : 'No se pudo actualizar la contraseña.'}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-between gap-2">
          <button
            type="button"
            disabled={change.isPending}
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
            className="h-11 rounded-lg border border-border px-4 text-sm"
          >
            Cerrar sesión
          </button>
          <button
            type="submit"
            disabled={change.isPending}
            className="h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {change.isPending ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </div>
      </form>
    </main>
  );
}
