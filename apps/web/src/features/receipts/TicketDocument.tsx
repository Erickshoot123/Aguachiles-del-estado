import type { Ticket } from '@aguachiles/shared';
import QRCode from 'qrcode';
import type { JSX } from 'react';
import { formatCurrency } from '../orders/channelLabels';
import './ticketDocument.css';

function WhatsAppCode({ url }: { url: string }): JSX.Element | null {
  try {
    const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' });
    const quietZone = 4;
    const size = modules.size + quietZone * 2;
    const squares: string[] = [];
    for (let row = 0; row < modules.size; row++) {
      for (let column = 0; column < modules.size; column++) {
        if (modules.get(row, column))
          squares.push(`M${column + quietZone} ${row + quietZone}h1v1h-1z`);
      }
    }
    return (
      <figure>
        <svg
          role="img"
          aria-label="Código QR de WhatsApp"
          viewBox={`0 0 ${size} ${size}`}
          shapeRendering="crispEdges"
        >
          <rect width={size} height={size} fill="white" />
          <path d={squares.join('')} fill="black" />
        </svg>
        <figcaption>WhatsApp del pedido</figcaption>
      </figure>
    );
  } catch {
    return null;
  }
}

export function TicketDocument({ ticket }: { ticket: Ticket }): JSX.Element {
  const details = [
    ['Cliente', ticket.customerName],
    ['Teléfono', ticket.customerPhone],
    ['Dirección', ticket.deliveryAddress],
    ['Referencias', ticket.deliveryReferences],
    ['Notas', ticket.notes],
  ];
  const totals = [
    ['Subtotal', ticket.subtotal],
    ['Impuestos', ticket.taxTotal],
    ['Descuento', -ticket.discountTotal],
    ['Envío', ticket.deliveryFee ?? 0],
  ] as const;

  return (
    <article className="pos-ticket-document" data-format={ticket.format}>
      <header>
        <h2>{ticket.businessName}</h2>
        <p>{ticket.purpose === 'kitchen' ? 'Comanda de cocina' : 'Ticket de venta'}</p>
        {ticket.isReprint ? <p>Reimpresión</p> : null}
      </header>
      <div className="pos-ticket-section">
        <p>
          Pedido {ticket.ticketNumber}
          {ticket.channelLabel ? ` · ${ticket.channelLabel}` : ''}
        </p>
        <p>{new Date(ticket.issuedAt).toLocaleString('es-MX')}</p>
        {details.map(([label, value]) =>
          value ? (
            <p key={label}>
              <strong>{label}:</strong> {value}
            </p>
          ) : null,
        )}
      </div>
      <ul className="pos-ticket-section">
        {ticket.lines.map((line, index) => (
          <li key={index}>
            <div className="pos-ticket-row">
              <span>
                {line.quantity}× {line.productName}
              </span>
              {ticket.purpose !== 'kitchen' ? <span>{formatCurrency(line.subtotal)}</span> : null}
            </div>
            {line.notes ? <p>{line.notes}</p> : null}
          </li>
        ))}
      </ul>
      <div className="pos-ticket-section">
        {ticket.purpose !== 'kitchen' &&
        totals.some(([label, amount]) => label !== 'Subtotal' && amount !== 0)
          ? totals
              .filter(([, amount]) => amount !== 0)
              .map(([label, amount]) => (
                <p className="pos-ticket-row" key={label}>
                  <span>{label}</span>
                  <span>{formatCurrency(amount)}</span>
                </p>
              ))
          : null}
        <p className="pos-ticket-row">
          <strong>Total</strong>
          <strong>{formatCurrency(ticket.total)}</strong>
        </p>
      </div>
      {ticket.whatsappUrl ? <WhatsAppCode url={ticket.whatsappUrl} /> : null}
    </article>
  );
}
