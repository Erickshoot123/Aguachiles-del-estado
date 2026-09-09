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
