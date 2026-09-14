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
}

export interface WhatsAppOrderInput {
  ticketNumber: string;
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
  }

  if (notes) {
    lines.push('');
    lines.push(`Notas: ${notes}`);
  }

  return lines.join('\n');
}

function toWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Arma el texto y la liga wa.me para compartir un pedido delivery. Solo
 * datos de logística de entrega (quién, dónde, qué) — nada de montos: el
 * negocio no quiere el total, el envío, el método de pago, "paga con" ni el
 * cambio en este mensaje. Sin emojis; la única marca de formato de WhatsApp
 * que usa es *negrita* en el folio. Si la URL resultante excede ~900
 * caracteres, recorta primero las notas (lo menos esencial del mensaje)
 * hasta que quepa o hasta quitarlas del todo, y lo marca como `truncated`
 * para avisar en la UI.
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
