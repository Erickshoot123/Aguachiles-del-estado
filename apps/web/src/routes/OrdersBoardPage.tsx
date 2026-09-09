import type { JSX } from 'react';
import { AppShell } from '../components/AppShell';
import { BOARD_COLUMNS } from '../features/orders/boardColumns';

const UI_TEXT = {
  title: 'Tablero de pedidos',
  subtitle: 'Aún no hay pedidos — la captura y el seguimiento llegan en la Fase 1 del plan.',
  newOrder: 'Nuevo pedido',
  emptyColumn: 'Sin pedidos',
} as const;

export function OrdersBoardPage(): JSX.Element {
  return (
    <AppShell>
      <header className="flex flex-wrap items-center gap-6 border-b border-border bg-surface px-7 py-[18px]">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="m-0 text-[23px] font-bold tracking-tight">{UI_TEXT.title}</h1>
          <p className="m-0 text-[13px] text-muted">{UI_TEXT.subtitle}</p>
        </div>
        <button
          type="button"
          disabled
          title={UI_TEXT.subtitle}
          className="ml-auto h-11 cursor-not-allowed rounded-lg bg-accent px-4 text-[14px] font-semibold text-white opacity-60"
        >
          {UI_TEXT.newOrder}
        </button>
      </header>

      <section className="grid flex-1 grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {BOARD_COLUMNS.map((column) => (
          <div
            key={column.key}
            className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-surface"
          >
            <div className="flex items-center gap-2.5 border-b border-divider px-3 py-3.5">
              <span className={`h-[22px] w-1 rounded ${column.accentClassName}`} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{column.title}</span>
                <span className="font-mono text-[11px] text-muted-2">{column.subtitle}</span>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center p-6 text-[13px] text-muted-2">
              {UI_TEXT.emptyColumn}
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
