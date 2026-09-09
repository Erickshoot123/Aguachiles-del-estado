import { zodResolver } from '@hookform/resolvers/zod';
import { loginRequestSchema, type LoginRequest } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';
import { useLogin } from '../features/auth/useLogin';

const UI_TEXT = {
  brand: 'Aguachiles',
  brandSubtitle: 'Cocina · solo delivery',
  emailLabel: 'Correo electrónico',
  passwordLabel: 'Contraseña',
  submit: 'Ingresar',
  submitting: 'Ingresando…',
  genericError: 'No se pudo iniciar sesión. Verifica tus datos.',
} as const;

export function LoginPage(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema) });

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = handleSubmit((values) => {
    loginMutation.mutate(values);
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8"
      >
        <div className="mb-6 flex flex-col gap-0.5">
          <span className="text-[19px] font-bold tracking-tight">{UI_TEXT.brand}</span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-2">
            {UI_TEXT.brandSubtitle}
          </span>
        </div>

        <label className="mb-1 block text-sm font-medium text-text" htmlFor="email">
          {UI_TEXT.emailLabel}
        </label>
        <input
          id="email"
          type="email"
          className="mb-1 w-full rounded-lg border border-border px-3 py-2 focus:border-accent focus:outline-none"
          {...register('email')}
        />
        {errors.email ? (
          <p className="mb-3 text-sm text-red-600">{errors.email.message}</p>
        ) : (
          <div className="mb-3" />
        )}

        <label className="mb-1 block text-sm font-medium text-text" htmlFor="password">
          {UI_TEXT.passwordLabel}
        </label>
        <input
          id="password"
          type="password"
          className="mb-1 w-full rounded-lg border border-border px-3 py-2 focus:border-accent focus:outline-none"
          {...register('password')}
        />
        {errors.password ? (
          <p className="mb-3 text-sm text-red-600">{errors.password.message}</p>
        ) : (
          <div className="mb-3" />
        )}

        {loginMutation.isError ? (
          <p className="mb-3 text-sm text-red-600">{UI_TEXT.genericError}</p>
        ) : null}

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full rounded-lg bg-accent px-3 py-2 font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {loginMutation.isPending ? UI_TEXT.submitting : UI_TEXT.submit}
        </button>
      </form>
    </div>
  );
}
