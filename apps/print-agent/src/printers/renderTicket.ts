import {
  characterSet as CharacterSet,
  printer as ThermalPrinter,
  types as PrinterTypes,
} from 'node-thermal-printer';
import type { Ticket } from '@aguachiles/shared';
import type { PrinterConfig } from '../config/env.js';

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function renderTicket(
  ticket: Ticket,
  printerConfig: PrinterConfig,
  width: number,
): InstanceType<typeof ThermalPrinter> {
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: printerConfig.interface,
    width,
    // WPC1252 cubre acentos y ñ; sin esto, node-thermal-printer busca a
    // tientas entre todas las tablas de códigos en cada carácter no-ASCII.
    characterSet: CharacterSet.WPC1252,
  });

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
  return printer;
}
