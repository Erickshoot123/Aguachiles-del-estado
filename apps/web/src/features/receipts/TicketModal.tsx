import type { PrintMode, PrintTarget, TicketFormat } from '@aguachiles/shared';
import type { JSX } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { ApiError } from '../../lib/apiClient';
import { formatCurrency } from '../orders/channelLabels';
import { useAgentPrinters, usePrintTicket, useReceipt } from './hooks';
import { usePrintSettingsStore } from './printSettingsStore';

const UI_TEXT = {
  loading: 'Cargando ticket…',
  error: 'No se pudo cargar el ticket.',
  print: 'Imprimir',
  printing: 'Imprimiendo…',
  reprint: 'Reimprimir',
  retry: 'Reintentar',
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
  modeLabel: 'Cómo imprimir',
  modeLocal: 'Agente local',
  modeNetwork: 'Impresora de red',
  modeOtherTerminal: 'Impresora de otra terminal',
  networkHostPlaceholder: 'IP de la impresora, ej. 192.168.1.50',
  networkPortPlaceholder: 'Puerto',
  otherTerminalUrlPlaceholder: 'URL del agente, ej. http://192.168.1.20:4000',
} as const;

const FORMAT_OPTIONS: { value: TicketFormat; label: string }[] = [
  { value: 'thermal_58', label: UI_TEXT.format58 },
  { value: 'thermal_80', label: UI_TEXT.format80 },
];

const MODE_OPTIONS: { value: PrintMode; label: string }[] = [
  { value: 'agente_local', label: UI_TEXT.modeLocal },
  { value: 'red', label: UI_TEXT.modeNetwork },
  { value: 'otra_terminal', label: UI_TEXT.modeOtherTerminal },
];

/** Construye el destino de impresión a partir de la configuración guardada de esta terminal. */
export function buildPrintTarget(settings: {
  printMode: PrintMode;
  networkPrinter: { host: string; port: number };
  otherTerminal: { agentUrl: string };
}): PrintTarget {
  if (settings.printMode === 'red') {
    return { mode: 'red', host: settings.networkPrinter.host, port: settings.networkPrinter.port };
  }
  if (settings.printMode === 'otra_terminal') {
    return { mode: 'otra_terminal', agentUrl: settings.otherTerminal.agentUrl };
  }
  return { mode: 'agente_local' };
}

/** ¿Falta configuración para poder imprimir con el modo elegido? */
export function isPrintTargetIncomplete(target: PrintTarget): boolean {
  if (target.mode === 'red') return target.host.trim().length === 0;
  if (target.mode === 'otra_terminal') return target.agentUrl.trim().length === 0;
  return false;
}

/**
 * Solo un ApiError trae un mensaje que nosotros redactamos (el Print Agent o
 * el backend respondiendo con un error controlado). Cualquier otro error
 * (ej. "Failed to fetch" cuando ni siquiera hay respuesta porque la
 * impresora/agente está apagado) es un TypeError crudo del navegador, nada
 * claro para un cajero — en ese caso usamos el mensaje genérico.
 */
export function printErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function PrintSettingsControls(): JSX.Element {
  const {
    ticketFormat,
    printerId,
    printMode,
    networkPrinter,
    otherTerminal,
    setTicketFormat,
    setPrinterId,
    setPrintMode,
    setNetworkPrinter,
    setOtherTerminal,
  } = usePrintSettingsStore();
  const printersQuery = useAgentPrinters(printMode === 'agente_local');
  const printers = printersQuery.data ?? [];

  return (
    <div className="flex flex-col gap-2 font-sans text-[12px]">
      <div className="flex items-center gap-2">
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
        {printMode === 'agente_local' && printers.length > 1 ? (
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

      <label className="flex flex-col gap-1">
        <span className="text-muted">{UI_TEXT.modeLabel}</span>
        <select
          value={printMode}
          onChange={(event) => setPrintMode(event.target.value as PrintMode)}
          className="rounded-lg border border-border px-2 py-1.5"
        >
          {MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {printMode === 'red' ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={networkPrinter.host}
            onChange={(event) => setNetworkPrinter({ ...networkPrinter, host: event.target.value })}
            placeholder={UI_TEXT.networkHostPlaceholder}
            className="flex-1 rounded-lg border border-border px-2 py-1.5"
          />
          <input
            type="number"
            value={networkPrinter.port}
            onChange={(event) =>
              setNetworkPrinter({ ...networkPrinter, port: Number(event.target.value) || 9100 })
            }
            placeholder={UI_TEXT.networkPortPlaceholder}
            className="w-20 rounded-lg border border-border px-2 py-1.5"
          />
        </div>
      ) : null}

      {printMode === 'otra_terminal' ? (
        <input
          type="text"
          value={otherTerminal.agentUrl}
          onChange={(event) => setOtherTerminal({ agentUrl: event.target.value })}
          placeholder={UI_TEXT.otherTerminalUrlPlaceholder}
          className="rounded-lg border border-border px-2 py-1.5"
        />
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
  const { ticketFormat, printerId, printMode, networkPrinter, otherTerminal } =
    usePrintSettingsStore();
  const ticket = receiptQuery.data?.ticket;
  const target = buildPrintTarget({ printMode, networkPrinter, otherTerminal });
  const targetIncomplete = isPrintTargetIncomplete(target);

  const handlePrint = (): void => {
    if (!ticket || targetIncomplete) return;
    printTicket.mutate({ ticket: { ...ticket, format: ticketFormat }, printerId, target });
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
            <p className="text-center text-[12px] text-red-600">
              {printErrorMessage(printTicket.error, UI_TEXT.printError)}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handlePrint}
            disabled={printTicket.isPending || targetIncomplete}
            className="h-11 rounded-lg bg-text font-sans text-[14px] font-semibold text-white hover:bg-accent disabled:opacity-60"
          >
            {printTicket.isPending
              ? UI_TEXT.printing
              : printTicket.isError
                ? UI_TEXT.retry
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
