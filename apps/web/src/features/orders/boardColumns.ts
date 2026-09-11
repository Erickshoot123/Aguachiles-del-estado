import type { Order } from '@aguachiles/shared';

export type BoardColumnKey = 'in_prep' | 'waiting_pickup' | 'in_delivery';

export interface BoardColumn {
  key: BoardColumnKey;
  title: string;
  subtitle: string;
  accentClassName: string;
  advanceActionLabel: string;
}

export const BOARD_COLUMNS: readonly BoardColumn[] = [
  {
    key: 'in_prep',
    title: 'En preparación',
    subtitle: 'Cocina',
    accentClassName: 'bg-accent',
    advanceActionLabel: 'Listo',
  },
  {
    key: 'waiting_pickup',
    title: 'En espera de recolección',
    subtitle: 'Barra de salida',
    accentClassName: 'bg-border-hover',
    advanceActionLabel: 'Recogido',
  },
  {
    key: 'in_delivery',
    title: 'En delivery',
    subtitle: 'En ruta',
    accentClassName: 'bg-text',
    advanceActionLabel: 'Entregado',
  },
];

// Un pedido de mostrador se recoge ahí mismo apenas está listo: en la
// columna "En preparación" su acción es "Entregado" en vez de "Listo", y al
// hacer clic pasa directo a entregado sin las etapas de recolección/delivery.
export function getAdvanceActionLabel(
  order: Pick<Order, 'channel' | 'fulfillmentStatus'>,
): string | null {
  if (order.fulfillmentStatus === 'in_prep' && order.channel === 'counter') {
    return 'Entregado';
  }
  return BOARD_COLUMNS.find((column) => column.key === order.fulfillmentStatus)?.advanceActionLabel ?? null;
}
