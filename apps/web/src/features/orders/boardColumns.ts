export interface BoardColumn {
  key: 'in_prep' | 'waiting_pickup' | 'in_delivery';
  title: string;
  subtitle: string;
  accentClassName: string;
}

export const BOARD_COLUMNS: readonly BoardColumn[] = [
  {
    key: 'in_prep',
    title: 'En preparación',
    subtitle: 'Cocina',
    accentClassName: 'bg-accent',
  },
  {
    key: 'waiting_pickup',
    title: 'En espera de recolección',
    subtitle: 'Barra de salida',
    accentClassName: 'bg-border-hover',
  },
  {
    key: 'in_delivery',
    title: 'En delivery',
    subtitle: 'En ruta',
    accentClassName: 'bg-text',
  },
];
