import { Prisma } from '@prisma/client';
import type { MovementWithMethod } from './cashMath.js';

export function mandaditoSummary(movements: MovementWithMethod[]) {
  const expenses = movements.filter(
    (movement) => movement.type === 'expense' && movement.category === 'mandadito',
  );
  const total = (type?: string) =>
    expenses
      .filter((movement) => !type || movement.paymentMethod?.type === type)
      .reduce((sum, movement) => sum.add(movement.amount), new Prisma.Decimal(0))
      .toNumber();
  return {
    mandaditoTotal: total(),
    mandaditoCashTotal: total('cash'),
    mandaditoTransferTotal: total('transfer'),
  };
}
