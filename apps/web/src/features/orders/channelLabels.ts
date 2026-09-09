import type { SaleChannel } from '@aguachiles/shared';

export const CHANNEL_LABELS: Record<SaleChannel, string> = {
  own_app: 'App propia',
  phone: 'Teléfono',
  whatsapp: 'WhatsApp',
  digital_counter: 'Mostrador digital',
  other: 'Otro',
};

export function formatElapsedMinutes(createdAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  return `${minutes} min`;
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}
