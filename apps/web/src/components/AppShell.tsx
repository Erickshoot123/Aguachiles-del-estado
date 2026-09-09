import type { JSX, ReactNode } from 'react';
import { useAuthStore } from '../features/auth/authStore';

const NAV_SECTIONS = [
  {
    title: 'Operación',
    items: [
      { label: 'Pedidos', active: true },
      { label: 'Menú y productos', active: false },
      { label: 'Inventario', active: false },
    ],
  },
  {
    title: 'Administración',
    items: [
      { label: 'Caja y cierre', active: false },
      { label: 'Reportes', active: false },
    ],
  },
] as const;

const UI_TEXT = {
  brand: 'Aguachiles',
  brandSubtitle: 'Cocina · solo delivery',
  logout: 'Cerrar sesión',
} as const;

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  return (
    <div className="flex min-h-screen w-full bg-bg">
      <aside className="flex w-[232px] shrink-0 flex-col gap-6 border-r border-border bg-surface p-4">
        <div className="flex flex-col gap-0.5 px-1.5">
          <span className="text-[19px] font-bold tracking-tight">{UI_TEXT.brand}</span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-2">
            {UI_TEXT.brandSubtitle}
          </span>
        </div>

        <nav className="flex flex-col gap-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-0.5">
              <div className="px-2.5 pb-2 font-mono text-[10px] uppercase tracking-widest text-muted-2">
                {section.title}
              </div>
              {section.items.map((item) => (
                <div
                  key={item.label}
                  className={
                    item.active
                      ? 'flex min-h-[44px] items-center rounded-[9px] bg-accent-soft px-3 text-[15px] font-semibold text-accent-hover'
                      : 'flex min-h-[44px] items-center rounded-[9px] px-3 text-[15px] text-muted-2'
                  }
                >
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2.5 border-t border-border pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-muted">{user?.name}</span>
          </div>
          <button
            type="button"
            onClick={clearSession}
            className="rounded-lg border border-border px-3 py-2 text-left text-[13px] text-text hover:border-border-hover"
          >
            {UI_TEXT.logout}
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
