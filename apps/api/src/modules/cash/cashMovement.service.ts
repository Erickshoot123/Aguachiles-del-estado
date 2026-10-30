import { Prisma, type PrismaClient } from '@prisma/client';
import type { CreateCashMovementRequest } from '@aguachiles/shared';
import { assertLocalRegister } from '../locations/localLocation.repository.js';
import { CashSessionAlreadyClosedError, CashSessionNotFoundError } from './cash.errors.js';

export async function createCashMovement(db: PrismaClient, sessionId: string, userId: string, input: CreateCashMovementRequest) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM cash_register_sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.cashRegisterSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new CashSessionNotFoundError();
    if (session.status !== 'open') throw new CashSessionAlreadyClosedError();
    await assertLocalRegister(tx, session.cashRegisterId);
    const movement = await tx.cashMovement.create({ data: { sessionId, type: input.type,
      amount: new Prisma.Decimal(input.amount), description: input.description, userId }, include: { user: true } });
    return { id: movement.id, type: movement.type, amount: movement.amount.toNumber(),
      description: movement.description, userName: movement.user.name, createdAt: movement.createdAt.toISOString() };
  });
}
