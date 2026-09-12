import type { printer as ThermalPrinter } from 'node-thermal-printer';
import type { Ticket } from '../ticket.js';

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Única fuente de verdad del contenido del ticket. La usan el Print Agent
 * (modo agente local, y cuando reenvía el ticket de otra terminal) y el
 * backend (modo impresora de red) para que el ticket impreso sea idéntico
 * sin importar el camino que tomó.
 */
export function renderTicketCommands(
  printer: InstanceType<typeof ThermalPrinter>,
  ticket: Ticket,
): void {
  printer.alignCenter();
  printer.bold(true);
  printer.println(ticket.businessName.toUpperCase());
  printer.bold(false);
  printer.println('Cocina · solo delivery');
  printer.drawLine();

  printer.alignLeft();
  printer.leftRight('Pedido', ticket.ticketNumber);
  printer.leftRight('Hora', new Date(ticket.issuedAt).toLocaleTimeString('es-MX'));
  printer.drawLine();

  for (const line of ticket.lines) {
    printer.leftRight(`${line.quantity}x ${line.productName}`, formatMoney(line.subtotal));
  }
  printer.drawLine();

  printer.bold(true);
  printer.leftRight('TOTAL', formatMoney(ticket.total));
  printer.bold(false);

  if (ticket.isReprint) {
    printer.newLine();
    printer.alignCenter();
    printer.println('** REIMPRESIÓN **');
  }

  printer.cut();
}
