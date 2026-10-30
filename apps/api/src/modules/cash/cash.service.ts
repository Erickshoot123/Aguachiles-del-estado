import { Prisma, type CashRegister as PrismaCashRegister, type PrismaClient } from '@prisma/client';
import type { CashMovement, CashRegister, CashSession } from '@aguachiles/shared';
import { recordAuditLog } from '../audit/audit.service.js';
import { assertLocalRegister, getLocalLocation } from '../locations/localLocation.repository.js';
import {
  CashSessionAlreadyOpenError,
  CashSessionNotFoundError,
  NoCashRegisterConfiguredError,
  NoOpenCashSessionError,
} from './cash.errors.js';

import { toCashSessionDto } from './cashDto.js';

import { cashMovementsDelta } from './cashMath.js';
export { cashMovementsDelta, type MovementWithMethod } from './cashMath.js';
export { closeSession } from './cashClose.service.js';

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

function toCashRegisterDto(cashRegister: PrismaCashRegister): CashRegister {
  return {
    id: cashRegister.id,
    name: cashRegister.name,
    location: cashRegister.location,
    isActive: cashRegister.isActive,
  };
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

export async function listCashRegisters(prisma: PrismaClient): Promise<CashRegister[]> {
  const location = await getLocalLocation(prisma);
  const cashRegisters = await prisma.cashRegister.findMany({
    where: { isActive: true, locationId: location.id },
    orderBy: { name: 'asc' },
  });
  return cashRegisters.map(toCashRegisterDto);
}

export async function getCurrentSession(
  prisma: PrismaClient,
  cashRegisterId: string,
): Promise<CashSession | null> {
  await assertLocalRegister(prisma, cashRegisterId);
  const session = await prisma.cashRegisterSession.findFirst({
    where: { status: 'open', cashRegisterId },
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
  cashRegisterId: string,
  openingAmount: number,
): Promise<CashSession> {
  await assertLocalRegister(prisma, cashRegisterId);
  const cashRegister = await prisma.cashRegister.findFirst({
    where: { id: cashRegisterId, isActive: true },
  });
  if (!cashRegister) {
    throw new NoCashRegisterConfiguredError();
  }

  const existingOpen = await prisma.cashRegisterSession.findFirst({
    where: { status: 'open', cashRegisterId },
  });
  if (existingOpen) {
    throw new CashSessionAlreadyOpenError();
  }

  // El SELECT de arriba es solo un atajo para el caso común (devuelve un
  // error claro sin ir hasta el INSERT); la garantía real contra dos
  // aperturas concurrentes en la misma caja es el índice único parcial de
  // la migración (cash_register_id) WHERE status = 'open' -- sin él, dos
  // solicitudes simultáneas pueden pasar ambas el SELECT antes de que
  // ninguna haya insertado su fila.
  let session;
  try {
    session = await prisma.cashRegisterSession.create({
      data: {
        cashRegisterId: cashRegister.id,
        openedByUserId: userId,
        openingAmount: new Prisma.Decimal(openingAmount),
      },
      include: { cashRegister: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new CashSessionAlreadyOpenError();
    }
    throw error;
  }

  await recordAuditLog(prisma, {
    userId,
    action: 'cash_session_opened',
    entity: 'cash_session',
    entityId: session.id,
    newValue: { cashRegisterName: cashRegister.name, openingAmount },
  });

  return toCashSessionDto(session);
}

export async function requireOpenSession(
  prisma: PrismaClient,
  cashRegisterId: string,
): Promise<{ id: string }> {
  await assertLocalRegister(prisma, cashRegisterId);
  const session = await prisma.cashRegisterSession.findFirst({
    where: { status: 'open', cashRegisterId },
  });
  if (!session) {
    throw new NoOpenCashSessionError();
  }
  return { id: session.id };
}

export async function listCashMovements(
  prisma: PrismaClient,
  sessionId: string,
): Promise<CashMovement[]> {
  const session = await prisma.cashRegisterSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new CashSessionNotFoundError();
  }
  await assertLocalRegister(prisma, session.cashRegisterId);
  const movements = await prisma.cashMovement.findMany({
    where: { sessionId },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });
  return movements.map(toCashMovementDto);
}

export { createCashMovement } from './cashMovement.service.js';
