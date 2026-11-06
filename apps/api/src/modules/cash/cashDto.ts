import type { Prisma } from '@prisma/client';
import type { CashSession } from '@aguachiles/shared';

type SessionWithRegister = Prisma.CashRegisterSessionGetPayload<{
  include: { cashRegister: true };
}>;

export function toCashSessionDto(
  session: SessionWithRegister,
  expenses = { mandaditoTotal: 0, mandaditoCashTotal: 0, mandaditoTransferTotal: 0 },
): CashSession {
  return {
    ...expenses,
    id: session.id,
    cashRegisterId: session.cashRegisterId,
    cashRegisterName: session.cashRegister.name,
    status: session.status,
    openedAt: session.openedAt.toISOString(),
    closedAt: session.closedAt?.toISOString() ?? null,
    openingAmount: session.openingAmount.toNumber(),
    expectedClosingAmount: session.expectedClosingAmount?.toNumber() ?? null,
    actualClosingAmount: session.actualClosingAmount?.toNumber() ?? null,
    difference: session.difference?.toNumber() ?? null,
  };
}
