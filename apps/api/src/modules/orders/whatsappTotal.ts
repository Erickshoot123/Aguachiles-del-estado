export const formatWhatsAppTotal = (total: number): string => `Total: $${total.toFixed(2)}`;

/** Actualiza el QR de comprobantes anteriores sin modificar su snapshot contable. */
export function addTotalToWhatsAppUrl(value: string | null | undefined, total: number): string | null {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'wa.me') return value;
  const message = url.searchParams.get('text');
  if (!message) return value;
  const noteStart = message.indexOf('\nNotas:');
  const body = noteStart >= 0 ? message.slice(0, noteStart) : message;
  const notes = noteStart >= 0 ? message.slice(noteStart) : '';
  const totalLine = formatWhatsAppTotal(total);
  if (body.split('\n').includes(totalLine)) return value;
  const lines = body.trimEnd().split('\n').filter((line) => !/^Total: \$[0-9,.]+$/.test(line));
  url.searchParams.set('text', [...lines, totalLine].join('\n') + (notes ? '\n' + notes : ''));
  return url.toString();
}
