import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { cashMovementsDelta, type MovementWithMethod } from './cash.service.js';

let movementCounter = 0;

function movement(overrides: {
  type: MovementWithMethod['type'];
  amount: number;
  description?: string;
  paymentMethodType?: 'cash' | 'card' | 'transfer' | 'other';
}): MovementWithMethod {
  movementCounter += 1;
  const paymentMethod = overrides.paymentMethodType
    ? {
        id: `pm-${movementCounter}`,
        name: overrides.paymentMethodType,
        type: overrides.paymentMethodType,
        isActive: true,
      }
    : null;

  return {
    id: `mv-${movementCounter}`,
    sessionId: 'session-1',
    type: overrides.type,
    paymentMethodId: paymentMethod?.id ?? null,
    paymentMethod,
    amount: new Prisma.Decimal(overrides.amount),
    description: overrides.description ?? null,
    userId: 'user-1',
    createdAt: new Date(),
  };
}

describe('cashMovementsDelta', () => {
  it('suma las ventas en efectivo al total esperado', () => {
    const delta = cashMovementsDelta([
      movement({ type: 'sale_income', amount: 180, paymentMethodType: 'cash' }),
      movement({ type: 'sale_income', amount: 220, paymentMethodType: 'cash' }),
    ]);
    expect(delta.toNumber()).toBe(400);
  });

  it('ignora las ventas pagadas con tarjeta o transferencia', () => {
    const delta = cashMovementsDelta([
      movement({ type: 'sale_income', amount: 180, paymentMethodType: 'cash' }),
      movement({ type: 'sale_income', amount: 500, paymentMethodType: 'card' }),
      movement({ type: 'sale_income', amount: 300, paymentMethodType: 'transfer' }),
    ]);
    expect(delta.toNumber()).toBe(180);
  });

  it('resta retiros y gastos', () => {
    const delta = cashMovementsDelta([
      movement({ type: 'sale_income', amount: 1000, paymentMethodType: 'cash' }),
      movement({ type: 'withdrawal', amount: 200 }),
      movement({ type: 'expense', amount: 50 }),
    ]);
    expect(delta.toNumber()).toBe(750);
  });

  it('suma ingresos (depósitos) al efectivo esperado', () => {
    const delta = cashMovementsDelta([movement({ type: 'deposit', amount: 300 })]);
    expect(delta.toNumber()).toBe(300);
  });

  it('resta solo la porción de un reembolso pagada en efectivo', () => {
    const delta = cashMovementsDelta([
      movement({ type: 'sale_income', amount: 400, paymentMethodType: 'cash' }),
      movement({ type: 'refund', amount: 400, paymentMethodType: 'cash' }),
    ]);
    expect(delta.toNumber()).toBe(0);
  });

  it('un reembolso de una venta pagada con tarjeta no afecta el efectivo', () => {
    const delta = cashMovementsDelta([
      movement({ type: 'sale_income', amount: 400, paymentMethodType: 'card' }),
      movement({ type: 'refund', amount: 400, paymentMethodType: 'card' }),
    ]);
    expect(delta.toNumber()).toBe(0);
  });

  it('una lista vacía de movimientos no cambia el efectivo esperado', () => {
    expect(cashMovementsDelta([]).toNumber()).toBe(0);
  });
});
