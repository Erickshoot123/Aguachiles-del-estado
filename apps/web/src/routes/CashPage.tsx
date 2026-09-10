import type { CashSession } from '@aguachiles/shared';
import type { JSX } from 'react';
import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { CashMovementsPanel } from '../features/cash/CashMovementsPanel';
import { useCashRegisters, useCloseCashSession, useCurrentCashSession, useOpenCashSession } from '../features/cash/hooks';
import { useTerminalCashRegisterId, useTerminalStore } from '../features/cash/terminalStore';
import { formatCurrency } from '../features/orders/channelLabels';

const UI_TEXT = {
  title: 'Caja y cierre',
  loading: 'Cargando…',
  registerLabel: 'Caja de esta terminal',
  registerPrompt: 'Elige qué caja registradora opera esta terminal.',
  openTitle: 'Abrir caja',
  openingAmountLabel: 'Fondo inicial',
  openAction: 'Abrir caja',
  openingAction: 'Abriendo…',
  sessionOpenSince: 'Caja abierta desde',
  openingAmountShown: 'Fondo inicial',
  expectedSoFar: 'Efectivo esperado hasta ahora',
  closeTitle: 'Cerrar caja',
  actualAmountLabel: 'Efectivo contado',
  closeAction: 'Cerrar caja',
  closingAction: 'Cerrando…',
  lastCloseTitle: 'Último cierre',
  expected: 'Esperado',
  actual: 'Contado',
  difference: 'Diferencia',
} as const;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function RegisterSelector({ cashRegisterId }: { cashRegisterId: string | null }): JSX.Element {
  const registersQuery = useCashRegisters();
  const setCashRegisterId = useTerminalStore((state) => state.setCashRegisterId);

  return (
    <div className="mb-6 max-w-sm">
      <label className="mb-1 block text-sm font-medium text-text" htmlFor="cash-register">
        {UI_TEXT.registerLabel}
      </label>
      <select
        id="cash-register"
        value={cashRegisterId ?? ''}
        onChange={(event) => setCashRegisterId(event.target.value)}
        className="w-full rounded-lg border border-border px-3 py-2"
      >
        <option value="" disabled>
          —
        </option>
        {(registersQuery.data ?? []).map((register) => (
          <option key={register.id} value={register.id}>
            {register.name}
          </option>
        ))}
      </select>
      {!cashRegisterId ? <p className="mt-2 text-sm text-muted">{UI_TEXT.registerPrompt}</p> : null}
    </div>
  );
}

function OpenSessionForm({
  cashRegisterId,
  onOpened,
}: {
  cashRegisterId: string;
  onOpened: () => void;
}): JSX.Element {
  const [openingAmount, setOpeningAmount] = useState(0);
  const openSession = useOpenCashSession();

  return (
    <div className="max-w-sm rounded-2xl border border-border bg-surface p-6">
      <h2 className="m-0 mb-4 text-[17px] font-semibold">{UI_TEXT.openTitle}</h2>
      <label className="mb-1 block text-sm font-medium text-text" htmlFor="opening-amount">
        {UI_TEXT.openingAmountLabel}
      </label>
      <input
        id="opening-amount"
        type="number"
        min={0}
        value={openingAmount}
        onChange={(event) => setOpeningAmount(Number(event.target.value))}
        className="mb-4 w-full rounded-lg border border-border px-3 py-2"
      />
      <button
        type="button"
        disabled={openSession.isPending}
        onClick={() =>
          openSession.mutate({ cashRegisterId, openingAmount }, { onSuccess: onOpened })
        }
        className="w-full rounded-lg bg-accent px-3 py-2 font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {openSession.isPending ? UI_TEXT.openingAction : UI_TEXT.openAction}
      </button>
    </div>
  );
}

function OpenSessionPanel({
  session,
  onClosed,
}: {
  session: CashSession;
  onClosed: (closed: CashSession) => void;
}): JSX.Element {
  const [actualClosingAmount, setActualClosingAmount] = useState(0);
  const closeSession = useCloseCashSession();

  return (
    <div className="flex max-w-sm flex-col gap-6">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-600" />
          <span className="text-sm text-text">
            {UI_TEXT.sessionOpenSince} {formatDateTime(session.openedAt)}
          </span>
        </div>
        <p className="mb-1 text-sm text-muted">
          {UI_TEXT.openingAmountShown}: {formatCurrency(session.openingAmount)}
        </p>
        <p className="text-sm text-muted">
          {UI_TEXT.expectedSoFar}: {formatCurrency(session.expectedClosingAmount ?? session.openingAmount)}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="m-0 mb-4 text-[17px] font-semibold">{UI_TEXT.closeTitle}</h2>
        <label className="mb-1 block text-sm font-medium text-text" htmlFor="actual-amount">
          {UI_TEXT.actualAmountLabel}
        </label>
        <input
          id="actual-amount"
          type="number"
          min={0}
          value={actualClosingAmount}
          onChange={(event) => setActualClosingAmount(Number(event.target.value))}
          className="mb-4 w-full rounded-lg border border-border px-3 py-2"
        />
        <button
          type="button"
          disabled={closeSession.isPending}
          onClick={() =>
            closeSession.mutate(
              { sessionId: session.id, actualClosingAmount },
              { onSuccess: onClosed },
            )
          }
          className="w-full rounded-lg bg-text px-3 py-2 font-semibold text-white hover:bg-accent disabled:opacity-60"
        >
          {closeSession.isPending ? UI_TEXT.closingAction : UI_TEXT.closeAction}
        </button>
      </div>

      <CashMovementsPanel sessionId={session.id} />
    </div>
  );
}

function LastCloseSummary({ session }: { session: CashSession }): JSX.Element {
  return (
    <div className="mb-6 max-w-sm rounded-2xl border border-border bg-surface p-6">
      <h2 className="m-0 mb-3 text-[15px] font-semibold">{UI_TEXT.lastCloseTitle}</h2>
      <div className="flex flex-col gap-1 text-sm text-muted">
        <span>
          {UI_TEXT.expected}: {formatCurrency(session.expectedClosingAmount ?? 0)}
        </span>
        <span>
          {UI_TEXT.actual}: {formatCurrency(session.actualClosingAmount ?? 0)}
        </span>
        <span className="font-semibold text-text">
          {UI_TEXT.difference}: {formatCurrency(session.difference ?? 0)}
        </span>
      </div>
    </div>
  );
}

export function CashPage(): JSX.Element {
  const cashRegisterId = useTerminalCashRegisterId();
  const currentSessionQuery = useCurrentCashSession(cashRegisterId ?? '');
  const [lastClosed, setLastClosed] = useState<CashSession | null>(null);

  return (
    <AppShell>
      <header className="border-b border-border bg-surface px-7 py-[18px]">
        <h1 className="m-0 text-[23px] font-bold tracking-tight">{UI_TEXT.title}</h1>
      </header>

      <section className="flex-1 p-6">
        <RegisterSelector cashRegisterId={cashRegisterId} />

        {cashRegisterId && currentSessionQuery.isLoading ? (
          <p className="text-sm text-muted">{UI_TEXT.loading}</p>
        ) : null}

        {cashRegisterId && !currentSessionQuery.isLoading ? (
          <>
            {lastClosed && !currentSessionQuery.data ? <LastCloseSummary session={lastClosed} /> : null}
            {currentSessionQuery.data ? (
              <OpenSessionPanel
                session={currentSessionQuery.data}
                onClosed={(closed) => setLastClosed(closed)}
              />
            ) : (
              <OpenSessionForm cashRegisterId={cashRegisterId} onOpened={() => setLastClosed(null)} />
            )}
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
