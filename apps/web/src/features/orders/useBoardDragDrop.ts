import { useState, type DragEvent } from 'react';
import type { Order } from '@aguachiles/shared';
import type { BoardColumnKey } from './boardColumns';
import { useMoveOrder } from './hooks';
import { useEscapeDismiss } from '../../lib/escapeActions';
import { ApiError } from '../../lib/apiClient';

const ORDER_DRAG_TYPE = 'application/x-aguachiles-order';
export function useBoardDragDrop() {
  const move = useMoveOrder();
  const [dragged, setDragged] = useState<{ id: string; fromStatus: BoardColumnKey } | null>(null);
  const [over, setOver] = useState<BoardColumnKey | null>(null);
  const end = (): void => { setDragged(null); setOver(null); };
  useEscapeDismiss(end, Boolean(dragged));
  return {
    pending: move.isPending, over, end,
    error: move.isError ? move.error instanceof ApiError ? move.error.message : 'No se pudo mover el pedido. Intenta de nuevo.' : null,
    start: (event: DragEvent<HTMLElement>, order: Order): void => {
      if (move.isPending) { event.preventDefault(); return; }
      move.reset(); event.dataTransfer.setData(ORDER_DRAG_TYPE, order.id); event.dataTransfer.effectAllowed = 'move';
      setDragged({ id: order.id, fromStatus: order.fulfillmentStatus as BoardColumnKey });
    },
    hover: (event: DragEvent<HTMLElement>, status: BoardColumnKey): void => {
      if (!dragged || move.isPending) return;
      event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setOver(status);
    },
    drop: (event: DragEvent<HTMLElement>, status: BoardColumnKey): void => {
      event.preventDefault();
      if (dragged && !move.isPending && event.dataTransfer.getData(ORDER_DRAG_TYPE) === dragged.id && status !== dragged.fromStatus)
        move.mutate({ ...dragged, status });
      end();
    },
  };
}
