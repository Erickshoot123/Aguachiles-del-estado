import type { UserSummary } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { useResetUserPassword } from './hooks';

const UI_TEXT = {
  title: 'Restablecer contraseña',
  newPassword: 'Nueva contraseña',
  confirmPassword: 'Confirmar contraseña',
  mismatch: 'Las contraseñas no coinciden.',
  cancel: 'Cancelar',
  save: 'Restablecer',
  saving: 'Guardando…',
  error: 'No se pudo restablecer la contraseña. Debe tener al menos 8 caracteres.',
  success: 'Contraseña actualizada. Todas las sesiones activas de este usuario se cerraron.',
} as const;

interface ResetPasswordModalProps {
  user: Pick<UserSummary, 'id' | 'name'>;
  onClose: () => void;
}

export function ResetPasswordModal({ user, onClose }: ResetPasswordModalProps): JSX.Element {
  const resetPassword = useResetUserPassword();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit = newPassword.length >= 8 && passwordsMatch;

  const handleSubmit = (): void => {
    resetPassword.mutate({ userId: user.id, input: { newPassword } });
  };

  return (
    <ModalBackdrop
      onClose={onClose}
      contentClassName="flex w-full max-w-sm flex-col rounded-2xl bg-surface"
    >
      <div className="border-b border-divider px-5 py-4">
        <h2 className="m-0 text-[17px] font-semibold">{UI_TEXT.title}</h2>
        <p className="mt-1 text-sm text-muted">{user.name}</p>
      </div>

      {resetPassword.isSuccess ? (
        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="text-sm text-green-700">{UI_TEXT.success}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="flex flex-col gap-1 text-sm">
            {UI_TEXT.newPassword}
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            {UI_TEXT.confirmPassword}
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="rounded-lg border border-border px-3 py-2"
            />
          </label>

          {!passwordsMatch && confirmPassword.length > 0 ? (
            <p className="text-sm text-red-600">{UI_TEXT.mismatch}</p>
          ) : null}
          {resetPassword.isError ? <p className="text-sm text-red-600">{UI_TEXT.error}</p> : null}
        </div>
      )}

      <div className="flex gap-2.5 bg-bg px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-lg border border-border px-4 text-[14px]"
        >
          {UI_TEXT.cancel}
        </button>
        {!resetPassword.isSuccess ? (
          <button
            type="button"
            disabled={!canSubmit || resetPassword.isPending}
            onClick={handleSubmit}
            className="ml-auto h-11 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {resetPassword.isPending ? UI_TEXT.saving : UI_TEXT.save}
          </button>
        ) : null}
      </div>
    </ModalBackdrop>
  );
}
