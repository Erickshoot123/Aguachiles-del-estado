import type {
  PrinterSelection,
  PrinterSettingsStatus,
  Ticket,
  TicketFormat,
} from '@aguachiles/shared';
import { apiRequest } from '../../lib/apiClient';
import { env } from '../../lib/env';
import { printAtAgent } from './api';

export function getPrinterSettings(): Promise<PrinterSettingsStatus> {
  return apiRequest('/printer-settings', { baseUrl: env.VITE_PRINT_AGENT_URL });
}
export function savePrinterSettings(settings: PrinterSelection): Promise<unknown> {
  return apiRequest('/printer-settings', {
    baseUrl: env.VITE_PRINT_AGENT_URL,
    method: 'PUT',
    body: settings,
  });
}
export function printConnectionTest(format: TicketFormat, printerId: string): Promise<void> {
  const ticket: Ticket = {
    saleId: crypto.randomUUID(),
    ticketNumber: 'PRUEBA DE IMPRESION',
    format,
    businessName: 'Aguachiles del Estado',
    issuedAt: new Date().toISOString(),
    purpose: 'kitchen',
    lines: [{ productName: 'PRUEBA · No es un pedido', quantity: 1, unitPrice: 0, subtotal: 0 }],
    subtotal: 0,
    taxTotal: 0,
    discountTotal: 0,
    total: 0,
    isReprint: false,
    notes: 'Texto: aguachile, limón y camarón. Si puedes leerlo, confirma la salida del papel.',
  };
  return printAtAgent(ticket, printerId);
}
