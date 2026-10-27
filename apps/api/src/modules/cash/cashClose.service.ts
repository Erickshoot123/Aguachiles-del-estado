import { Prisma, type PrismaClient } from '@prisma/client';
import { recordAuditLog } from '../audit/audit.service.js';
import { assertLocalRegister } from '../locations/localLocation.repository.js';
import { CashSessionAlreadyClosedError, CashSessionNotFoundError } from './cash.errors.js';
import { cashMovementsDelta } from './cashMath.js';
import { toCashSessionDto } from './cashDto.js';

export async function closeSession(db: PrismaClient, sessionId: string, userId: string, actualClosingAmount: number) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM cash_register_sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.cashRegisterSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new CashSessionNotFoundError();
    if (session.status === 'closed') throw new CashSessionAlreadyClosedError();
    await assertLocalRegister(tx, session.cashRegisterId);
    const movements = await tx.cashMovement.findMany({ where: { sessionId }, include: { paymentMethod: true } });
    const expected = session.openingAmount.add(cashMovementsDelta(movements));
    const actual = new Prisma.Decimal(actualClosingAmount);
    const difference = actual.sub(expected);
    const updated = await tx.cashRegisterSession.update({ where: { id: sessionId }, data: {
      status: 'closed', closedByUserId: userId, closedAt: new Date(),
      expectedClosingAmount: expected, actualClosingAmount: actual, difference,
    }, include: { cashRegister: true } });
    await recordAuditLog(tx, { userId, action: 'cash_session_closed', entity: 'cash_session', entityId: sessionId,
      oldValue: { expectedClosingAmount: expected.toNumber() },
      newValue: { actualClosingAmount: actual.toNumber(), difference: difference.toNumber() } });
    return toCashSessionDto(updated);
  });
}
