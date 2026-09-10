import type { TicketFormat } from '@aguachiles/shared';
import type { JSX } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { formatCurrency } from '../orders/channelLabels';
import { useAgentPrinters, usePrintTicket, useReceipt } from './hooks';
import { usePrintSettingsStore } from './printSettingsStore';

const UI_TEXT = {
  loading: 'Cargando ticket…',
  error: 'No se pudo cargar el ticket.',
  print: 'Imprimir',
  printing: 'Imprimiendo…',
  reprint: 'Reimprimir',
  printError: 'No se pudo imprimir. Revisa la impresora e intenta de nuevo.',
  reprintCountLabel: (count: number) => `${count} reimpresión(es)`,
  close: 'Cerrar',
  subtitle: 'Cocina · solo delivery',
  order: 'Pedido',
  time: 'Hora',
  total: 'TOTAL',
  format58: '58mm',
  format80: '80mm',
  printerLabel: 'Impresora',
} as const;

const FORMAT_OPTIONS: { value: TicketFormat; label: string }[] = [
  { value: 'thermal_58', label: UI_TEXT.format58 },
  { value: 'thermal_80', label: UI_TEXT.format80 },
];

function PrintSettingsControls(): JSX.Element {
  const printersQuery = useAgentPrinters();
  const { ticketFormat, printerId, setTicketFormat, setPrinterId } = usePrintSettingsStore();
  const printers = printersQuery.data ?? [];

  return (
    <div className="flex items-center gap-2 font-sans text-[12px]">
      <div className="flex overflow-hidden rounded-lg border border-border">
        {FORMAT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTicketFormat(option.value)}
            className={
              ticketFormat === option.value
                ? 'bg-accent-soft px-2.5 py-1.5 font-semibold text-accent-hover'
                : 'px-2.5 py-1.5 text-muted hover:bg-bg'
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      {printers.length > 1 ? (
        <select
          value={printerId ?? printers[0]?.id ?? ''}
          onChange={(event) => setPrinterId(event.target.value)}
          className="flex-1 rounded-lg border border-border px-2 py-1.5"
        >
          {printers.map((printer) => (
            <option key={printer.id} value={printer.id}>
              {printer.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

interface TicketModalProps {
  orderId: string;
  onClose: () => void;
}

export function TicketModal({ orderId, onClose }: TicketModalProps): JSX.Element {
  const receiptQuery = useReceipt(orderId, true);
  const printTicket = usePrintTicket(orderId);
  const { ticketFormat, printerId } = usePrintSettingsStore();
  const ticket = receiptQuery.data?.ticket;

  const handlePrint = (): void => {
    if (!ticket) return;
    printTicket.mutate({ ticket: { ...ticket, format: ticketFormat }, printerId });
  };

  return (
    <ModalBackdrop
      onClose={onClose}
      zIndexClassName="z-50"
      contentClassName="flex w-80 flex-col gap-3.5 rounded-xl bg-surface p-6 font-mono"
    >
      {receiptQuery.isLoading ? (
        <p className="text-center text-sm text-muted">{UI_TEXT.loading}</p>
      ) : null}
      {receiptQuery.isError ? (
        <p className="text-center text-sm text-red-600">{UI_TEXT.error}</p>
      ) : null}

      {ticket ? (
        <>
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="font-sans text-[17px] font-bold">
              {ticket.businessName.toUpperCase()}
            </span>
            <span className="text-[11px] text-muted">{UI_TEXT.subtitle}</span>
          </div>

          <div className="flex flex-col gap-1.5 border-y border-dashed border-border-hover py-3 text-[12px]">
            <div className="flex justify-between">
              <span>{UI_TEXT.order}</span>
              <span>{ticket.ticketNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>{UI_TEXT.time}</span>
              <span>{new Date(ticket.issuedAt).toLocaleTimeString('es-MX')}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-[12px]">
            {ticket.lines.map((line) => (
              <div
                key={`${line.productName}-${line.quantity}`}
                className="flex justify-between gap-2.5"
              >
                <span>
                  {line.quantity}x {line.productName}
                </span>
                <span>{formatCurrency(line.subtotal)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between border-t border-dashed border-border-hover pt-3 text-[15px] font-semibold">
            <span>{UI_TEXT.total}</span>
            <span>{formatCurrency(ticket.total)}</span>
          </div>

          {receiptQuery.data && receiptQuery.data.reprintCount > 0 ? (
            <p className="text-center text-[11px] text-muted-2">
              {UI_TEXT.reprintCountLabel(receiptQuery.data.reprintCount)}
            </p>
          ) : null}

          <PrintSettingsControls />

          {printTicket.isError ? (
            <p className="text-center text-[12px] text-red-600">{UI_TEXT.printError}</p>
          ) : null}

          <button
            type="button"
            onClick={handlePrint}
            disabled={printTicket.isPending}
            className="h-11 rounded-lg bg-text font-sans text-[14px] font-semibold text-white hover:bg-accent disabled:opacity-60"
          >
            {printTicket.isPending
              ? UI_TEXT.printing
              : ticket.isReprint
                ? UI_TEXT.reprint
                : UI_TEXT.print}
          </button>
        </>
      ) : null}

      <button
        type="button"
        onClick={onClose}
        className="h-11 rounded-lg border border-border font-sans text-[14px]"
      >
        {UI_TEXT.close}
      </button>
    </ModalBackdrop>
  );
}
