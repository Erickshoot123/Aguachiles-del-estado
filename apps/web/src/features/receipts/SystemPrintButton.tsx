import type { Ticket } from '@aguachiles/shared';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';
import { TicketDocument } from './TicketDocument';

type PrintWindow = Window & {
  aguachilesSystemPrint?: boolean;
  chrome?: { webview?: { postMessage: (message: string) => void } };
};

function openPrintDialog(): void {
  const host = window as PrintWindow;
  if (host.aguachilesSystemPrint && host.chrome?.webview) {
    host.chrome.webview.postMessage('aguachiles:print-document');
    return;
  }
  window.print();
}

export function SystemPrintButton({ ticket }: { ticket: Ticket }): JSX.Element {
  return (
    <>
      {createPortal(
        <div className="pos-print-document" aria-hidden="true">
          <TicketDocument ticket={ticket} />
        </div>,
        document.body,
      )}
      <button
        type="button"
        className="min-h-11 rounded-lg border border-border px-3 font-sans text-sm font-semibold text-text hover:bg-accent-soft"
        onClick={openPrintDialog}
      >
        Elegir impresora…
      </button>
    </>
  );
}
