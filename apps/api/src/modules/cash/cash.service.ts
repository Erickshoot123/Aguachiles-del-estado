import { Prisma, type PrismaClient } from '@prisma/client';
import type { CashMovement, CashSession, CreateCashMovementRequest } from '@aguachiles/shared';
import {
  CashSessionAlreadyClosedError,
  CashSessionAlreadyOpenError,
  CashSessionNotFoundError,
  NoCashRegisterConfiguredError,
  NoOpenCashSessionError,
} from './cash.errors.js';

type SessionWithRegister = Prisma.CashRegisterSessionGetPayload<{
  include: { cashRegister: true };
}>;

type MovementWithMethod = Prisma.CashMovementGetPayload<{ include: { paymentMethod: true } }>;

type MovementWithUser = Prisma.CashMovementGetPayload<{ include: { user: true } }>;

function toCashMovementDto(movement: MovementWithUser): CashMovement {
  return {
    id: movement.id,
    type: movement.type,
    amount: movement.amount.toNumber(),
    description: movement.description,
    userName: movement.user.name,
    createdAt: movement.createdAt.toISOString(),
  };
}

function toCashSessionDto(session: SessionWithRegister): CashSession {
  return {
    id: session.id,
    cashRegisterName: session.cashRegister.name,
    status: session.status,
    openedAt: session.openedAt.toISOString(),
    closedAt: session.closedAt ? session.closedAt.toISOString() : null,
    openingAmount: session.openingAmount.toNumber(),
    expectedClosingAmount: session.expectedClosingAmount
      ? session.expectedClosingAmount.toNumber()
      : null,
    actualClosingAmount: session.actualClosingAmount ? session.actualClosingAmount.toNumber() : null,
    difference: session.difference ? session.difference.toNumber() : null,
  };
}

function cashMovementsDelta(movements: MovementWithMethod[]): Prisma.Decimal {
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

async function computeExpectedClosingAmount(
  prisma: PrismaClient,
  sessionId: string,
  openingAmount: Prisma.Decimal,
): Promise<Prisma.Decimal> {
  const movements = await prisma.cashMovement.findMany({
    where: { sessionId },
    include: { paymentMethod: true },
  });
  return openingAmount.add(cashMovementsDelta(movements));
}

export async function getCurrentSession(prisma: PrismaClient): Promise<CashSession | null> {
  const session = await prisma.cashRegisterSession.findFirst({
    where: { status: 'open' },
    include: { cashRegister: true },
  });
  if (!session) return null;

  const expected = await computeExpectedClosingAmount(prisma, session.id, session.openingAmount);

  return toCashSessionDto({
    ...session,
    expectedClosingAmount: expected,
  });
}

export async function openSession(
  prisma: PrismaClient,
  userId: string,
  openingAmount: number,
): Promise<CashSession> {
  const existingOpen = await prisma.cashRegisterSession.findFirst({ where: { status: 'open' } });
  if (existingOpen) {
    throw new CashSessionAlreadyOpenError();
  }

  const cashRegister = await prisma.cashRegister.findFirst({ where: { isActive: true } });
  if (!cashRegister) {
    throw new NoCashRegisterConfiguredError();
  }
  const session = await prisma.cashRegisterSession.create({
    data: {
      cashRegisterId: cashRegister.id,
      openedByUserId: userId,
      openingAmount: new Prisma.Decimal(openingAmount),
    },
    include: { cashRegister: true },
  });

  return toCashSessionDto(session);
}

export async function closeSession(
  prisma: PrismaClient,
  sessionId: string,
  userId: string,
  actualClosingAmount: number,
): Promise<CashSession> {
  const session = await prisma.cashRegisterSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new CashSessionNotFoundError();
  }
  if (session.status === 'closed') {
    throw new CashSessionAlreadyClosedError();
  }

  const expected = await computeExpectedClosingAmount(prisma, sessionId, session.openingAmount);
  const actual = new Prisma.Decimal(actualClosingAmount);

  const updated = await prisma.cashRegisterSession.update({
    where: { id: sessionId },
    data: {
      status: 'closed',
      closedByUserId: userId,
      closedAt: new Date(),
      expectedClosingAmount: expected,
      actualClosingAmount: actual,
      difference: actual.sub(expected),
    },
    include: { cashRegister: true },
  });

  return toCashSessionDto(updated);
}

export async function requireOpenSession(
  prisma: PrismaClient,
): Promise<{ id: string }> {
  const session = await prisma.cashRegisterSession.findFirst({ where: { status: 'open' } });
  if (!session) {
    throw new NoOpenCashSessionError();
  }
  return { id: session.id };
}

export async function createCashMovement(
  prisma: PrismaClient,
  sessionId: string,
  userId: string,
  input: CreateCashMovementRequest,
): Promise<CashMovement> {
  const session = await prisma.cashRegisterSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new CashSessionNotFoundError();
  }
  if (session.status !== 'open') {
    throw new CashSessionAlreadyClosedError();
  }
  const movement = await prisma.cashMovement.create({
    data: {
      sessionId,
      type: input.type,
      amount: new Prisma.Decimal(input.amount),
      description: input.description,
      userId,
    },
    include: { user: true },
  });
  return toCashMovementDto(movement);
}

export async function listCashMovements(
  prisma: PrismaClient,
  sessionId: string,
): Promise<CashMovement[]> {
  const session = await prisma.cashRegisterSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new CashSessionNotFoundError();
  }
  const movements = await prisma.cashMovement.findMany({
    where: { sessionId },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });
  return movements.map(toCashMovementDto);
}
