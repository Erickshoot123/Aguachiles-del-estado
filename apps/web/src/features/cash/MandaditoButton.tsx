import { useState, type JSX } from 'react';
import { MandaditoModal } from './MandaditoModal';

export function MandaditoButton({
  saleId,
  ticketNumber,
}: {
  saleId?: string;
  ticketNumber?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-accent px-3 py-2 text-sm font-semibold text-accent-hover"
      >
        Agregar Envío / Mandadito
      </button>
      {open ? (
        <MandaditoModal
          saleId={saleId}
          ticketNumber={ticketNumber}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
