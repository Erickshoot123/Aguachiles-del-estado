import { Prisma } from '@prisma/client';
export type MovementWithMethod = Prisma.CashMovementGetPayload<{ include: { paymentMethod: true } }>;

export function cashMovementsDelta(movements: MovementWithMethod[]): Prisma.Decimal {
  return movements.reduce((total, movement) => {
    if (movement.type === 'withdrawal' || movement.type === 'expense') {
      return total.sub(movement.amount);
    }
    if (movement.type === 'deposit') {
      return total.add(movement.amount);
    }
    if (movement.type === 'sale_income' && movement.paymentMethod?.type === 'cash') {
      return total.add(movement.amount);
    }
    if (movement.type === 'refund' && movement.paymentMethod?.type === 'cash') {
      return total.sub(movement.amount);
    }
    return total;
  }, new Prisma.Decimal(0));
}

