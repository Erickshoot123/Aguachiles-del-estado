import QRCode from 'qrcode';
import type { printer as ThermalPrinter } from 'node-thermal-printer';
import type { Ticket } from '../ticket.js';

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export interface RenderTicketOptions {
  /**
   * Cómo imprimir el QR de WhatsApp cuando el ticket trae `whatsappUrl`:
   * - 'native' (por defecto): comando ESC/POS nativo `GS ( k` (printQR),
   *   más rápido y nítido; lo soporta casi cualquier impresora térmica moderna.
   * - 'raster': genera el QR como imagen PNG y lo manda como bitmap
   *   (`GS v 0`, printImageBuffer) — para impresoras que no entienden el
   *   comando nativo.
   * - 'off': no imprime el QR aunque el ticket lo traiga.
   */
  qrMode?: 'native' | 'raster' | 'off';
}

/**
 * Única fuente de verdad del contenido del ticket. La usan el Print Agent
 * (modo agente local, y cuando reenvía el ticket de otra terminal) y el
 * backend (modo impresora de red) para que el ticket impreso sea idéntico
 * sin importar el camino que tomó.
 */
export async function renderTicketCommands(
  printer: InstanceType<typeof ThermalPrinter>,
  ticket: Ticket,
  options: RenderTicketOptions = {},
): Promise<void> {
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

  const qrMode = options.qrMode ?? 'native';
  if (ticket.whatsappUrl && qrMode !== 'off') {
    printer.newLine();
    printer.alignCenter();
    printer.println('Pedido por WhatsApp');
    if (qrMode === 'raster') {
      const png = await QRCode.toBuffer(ticket.whatsappUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        type: 'png',
      });
      await printer.printImageBuffer(png);
    } else {
      printer.printQR(ticket.whatsappUrl, { cellSize: 4, correction: 'M' });
    }
  }

  printer.cut();
}
