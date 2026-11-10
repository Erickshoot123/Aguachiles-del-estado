import type { UserSummary } from '@aguachiles/shared';
import type { JSX } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { ApiError } from '../../lib/apiClient';
import { useSetUserStatus } from './hooks';

export function UserStatusModal({
  user,
  onClose,
}: {
  user: UserSummary;
  onClose: () => void;
}): JSX.Element {
  const update = useSetUserStatus();
  const action = user.isActive ? 'Desactivar cuenta' : 'Reactivar cuenta';
  return (
    <ModalBackdrop onClose={onClose} contentClassName="w-full max-w-md rounded-2xl bg-surface p-5">
      <h2 className="text-xl font-semibold">{action}</h2>
      <p className="mt-2 text-sm">
        {user.isActive
          ? `${user.name} perderá el acceso al POS. Sus pedidos y movimientos se conservan.`
          : `${user.name} podrá volver a iniciar sesión con su contraseña.`}
      </p>
      {update.isError ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {update.error instanceof ApiError
            ? update.error.message
            : 'No se pudo cambiar el estado de la cuenta.'}
        </p>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-lg border border-border px-4 text-sm"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={update.isPending}
          onClick={() =>
            update.mutate({ userId: user.id, isActive: !user.isActive }, { onSuccess: onClose })
          }
          className="h-11 rounded-lg bg-text px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {update.isPending ? 'Guardando…' : action}
        </button>
      </div>
    </ModalBackdrop>
  );
}
