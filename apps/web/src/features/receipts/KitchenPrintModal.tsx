import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { getKitchenTicket } from './api';
import { usePrintSettingsStore } from './printSettingsStore';
import { SystemPrintButton } from './SystemPrintButton';
import { TicketDocument } from './TicketDocument';

export function KitchenPrintModal({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}): JSX.Element {
  const format = usePrintSettingsStore((settings) => settings.ticketFormat);
  const query = useQuery({
    queryKey: ['kitchen-ticket', orderId],
    queryFn: () => getKitchenTicket(orderId),
    staleTime: 0,
  });
  const ticket = query.data ? { ...query.data, format, isReprint: true } : null;

  return (
    <ModalBackdrop
      onClose={onClose}
      zIndexClassName="z-50"
      contentClassName="flex max-h-[calc(100dvh-48px)] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-xl bg-surface p-6"
    >
      {query.isPending ? <p role="status">Cargando comanda…</p> : null}
      {query.isError ? <p role="alert">No se pudo cargar la comanda.</p> : null}
      {ticket && !query.isError ? (
        <>
          <TicketDocument ticket={ticket} />
          <SystemPrintButton ticket={ticket} />
        </>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        className="h-11 rounded-lg border border-border text-sm"
      >
        Cerrar
      </button>
    </ModalBackdrop>
  );
}
