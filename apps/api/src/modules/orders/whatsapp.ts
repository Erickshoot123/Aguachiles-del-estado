import { formatWhatsAppTotal } from './whatsappTotal.js';
import type { WhatsAppShare } from '@aguachiles/shared';

// wa.me no impone un límite documentado, pero URLs muy largas dejan de ser
// prácticas para un QR (más denso, más lento y menos confiable de escanear
// con cámaras de gama baja) y algunos lectores móviles truncan el texto.
const MAX_URL_LENGTH = 900;
// Cuánto recortar las notas en cada intento; deliberadamente chico para no
// perder más contenido del necesario cuando el excedente es pequeño.
const NOTES_TRIM_STEP = 40;

export interface WhatsAppOrderItem {
  productName: string;
  quantity: number;
  notes?: string | null;
}

export interface WhatsAppOrderInput {
  ticketNumber: string;
  total: number;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryReferences: string | null;
  items: WhatsAppOrderItem[];
  notes: string | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
}

function buildMessage(order: WhatsAppOrderInput, notes: string | null): string {
  const lines: string[] = [];

  lines.push(`Pedido *${order.ticketNumber}*`);
  lines.push(`Hora: ${formatTime(order.createdAt)}`);
  lines.push(`Cliente: ${order.customerName}`);
  lines.push(`Tel: ${order.customerPhone}`);
  lines.push(`Dirección: ${order.deliveryAddress}`);
  if (order.deliveryReferences) {
    lines.push(`Referencias: ${order.deliveryReferences}`);
  }

  lines.push('');
  for (const item of order.items) {
    lines.push(`${item.quantity}x ${item.productName}`);
    if (item.notes) lines.push(`  ${item.notes}`);
  }

  lines.push(formatWhatsAppTotal(order.total));

  if (notes) {
    lines.push('');
    lines.push(`Notas: ${notes}`);
  }

  return lines.join('\n');
}

function toWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Comparte los datos de entrega y el total guardado del pedido.
 * Si hace falta reducir el QR, solo recorta notas; conserva productos y total.
 */
export function buildWhatsAppMessage(order: WhatsAppOrderInput): WhatsAppShare {
  let notes = order.notes;
  let message = buildMessage(order, notes);
  let url = toWhatsAppUrl(message);
  let truncated = false;

  while (url.length > MAX_URL_LENGTH && notes) {
    truncated = true;
    notes =
      notes.length > NOTES_TRIM_STEP
        ? `${notes.slice(0, notes.length - NOTES_TRIM_STEP).trimEnd()}…`
        : null;
    message = buildMessage(order, notes);
    url = toWhatsAppUrl(message);
  }

  return { message, url, truncated };
}
