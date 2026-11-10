import type { JSX } from 'react';
import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { useUsers } from '../features/users/hooks';
import { ResetPasswordModal } from '../features/users/ResetPasswordModal';
import { NewUserModal } from '../features/users/NewUserModal';
import { UserStatusModal } from '../features/users/UserStatusModal';

const UI_TEXT = {
  title: 'Usuarios',
  loading: 'Cargando usuarios…',
  error: 'No se pudieron cargar los usuarios.',
  empty: 'Aún no hay usuarios.',
  colName: 'Nombre',
  colUsername: 'Usuario',
  colRole: 'Rol',
  colStatus: 'Estado',
  active: 'Activo',
  inactive: 'Inactivo',
  resetPassword: 'Restablecer contraseña',
} as const;

export function UsersPage(): JSX.Element {
  const usersQuery = useUsers();
  const [isCreating, setIsCreating] = useState(false);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const resettingUser = usersQuery.data?.find((user) => user.id === resettingUserId);
  const changingStatus = usersQuery.data?.find((user) => user.id === changingStatusId);

  return (
    <AppShell>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-7 py-[18px]">
        <h1 className="m-0 text-[23px] font-bold tracking-tight">{UI_TEXT.title}</h1>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Nuevo usuario
        </button>
      </header>

      <section className="flex-1 overflow-x-auto p-5">
        {usersQuery.isLoading ? <p className="text-sm text-muted">{UI_TEXT.loading}</p> : null}
        {usersQuery.isError ? <p className="text-sm text-red-600">{UI_TEXT.error}</p> : null}

        {usersQuery.data ? (
          usersQuery.data.length === 0 ? (
            <p className="text-sm text-muted">{UI_TEXT.empty}</p>
          ) : (
            <table className="pos-zebra w-full border-collapse overflow-hidden rounded-2xl bg-surface text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[12px] uppercase tracking-wide text-muted-2">
                  <th className="px-4 py-3">{UI_TEXT.colName}</th>
                  <th className="px-4 py-3">{UI_TEXT.colUsername}</th>
                  <th className="px-4 py-3">{UI_TEXT.colRole}</th>
                  <th className="px-4 py-3">{UI_TEXT.colStatus}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.map((user) => (
                  <tr key={user.id} className="border-b border-divider last:border-0">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{user.username}</td>
                    <td className="px-4 py-3 capitalize">{user.roleName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          user.isActive
                            ? 'rounded-full bg-green-100 px-2.5 py-1 text-[12px] font-semibold text-green-700'
                            : 'rounded-full bg-bg px-2.5 py-1 text-[12px] font-semibold text-muted-2'
                        }
                      >
                        {user.isActive ? UI_TEXT.active : UI_TEXT.inactive}
                      </span>
                    </td>
                    <td className="space-x-2 px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setResettingUserId(user.id)}
                        className="rounded-lg border border-border px-3 py-1.5 text-[13px] hover:border-border-hover"
                      >
                        {UI_TEXT.resetPassword}
                      </button>
                      {user.roleName !== 'admin' ? (
                        <button
                          type="button"
                          onClick={() => setChangingStatusId(user.id)}
                          className="rounded-lg border border-border px-3 py-1.5 text-[13px] hover:border-border-hover"
                        >
                          {user.isActive ? 'Desactivar' : 'Reactivar'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </section>

      {isCreating ? <NewUserModal onClose={() => setIsCreating(false)} /> : null}
      {changingStatus ? (
        <UserStatusModal user={changingStatus} onClose={() => setChangingStatusId(null)} />
      ) : null}
      {resettingUser ? (
        <ResetPasswordModal user={resettingUser} onClose={() => setResettingUserId(null)} />
      ) : null}
    </AppShell>
  );
}
