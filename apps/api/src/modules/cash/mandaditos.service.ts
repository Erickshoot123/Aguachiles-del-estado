import { Prisma, type PrismaClient } from '@prisma/client';
import type { CreateMandaditoRequest, MandaditoExpense } from '@aguachiles/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { assertLocalRegister, assertLocalSale } from '../locations/localLocation.repository.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { CashSessionAlreadyClosedError, CashSessionNotFoundError } from './cash.errors.js';

const include = { user: true, paymentMethod: true } as const;
type Expense = Prisma.CashMovementGetPayload<{ include: typeof include }>;
function toExpense(movement: Expense): MandaditoExpense {
  return {
    id: movement.id,
    amount: movement.amount.toNumber(),
    description: movement.description,
    saleId: movement.saleId,
    paymentMethodName: movement.paymentMethod!.name,
    userName: movement.user.name,
    createdAt: movement.createdAt.toISOString(),
  };
}

export async function createMandadito(
  db: PrismaClient,
  sessionId: string,
  userId: string,
  input: CreateMandaditoRequest,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM cash_register_sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.cashRegisterSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new CashSessionNotFoundError();
    await assertLocalRegister(tx, session.cashRegisterId);
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${input.clientRequestId}, 0))`;
    const existing = await tx.cashMovement.findUnique({
      where: { clientRequestId: input.clientRequestId },
      include,
    });
    if (existing) {
      if (
        existing.sessionId !== sessionId ||
        existing.userId !== userId ||
        existing.category !== 'mandadito' ||
        existing.saleId !== (input.saleId ?? null) ||
        existing.paymentMethodId !== input.paymentMethodId ||
        !existing.amount.equals(input.amount) ||
        existing.description !== (input.description || null)
      )
        throw new ConflictError('Esta solicitud ya fue registrada con otros datos.');
      return toExpense(existing);
    }
    if (session.status !== 'open') throw new CashSessionAlreadyClosedError();
    const method = await tx.paymentMethod.findUnique({ where: { id: input.paymentMethodId } });
    if (!method?.isActive || !['cash', 'transfer'].includes(method.type))
      throw new ValidationError('Elige efectivo de caja o transferencia para pagar el mandadito.');
    if (input.saleId) {
      await assertLocalSale(tx, input.saleId);
      const sale = await tx.sale.findUnique({ where: { id: input.saleId } });
      if (!sale) throw new NotFoundError('El pedido no existe.');
      if (sale.channel !== 'delivery')
        throw new ValidationError('Asocia el gasto a un pedido de delivery.');
    }
    const expense = await tx.cashMovement.create({
      data: {
        sessionId,
        userId,
        category: 'mandadito',
        type: 'expense',
        saleId: input.saleId,
        clientRequestId: input.clientRequestId,
        amount: new Prisma.Decimal(input.amount),
        paymentMethodId: method.id,
        description: input.description || null,
      },
      include,
    });
    await recordAuditLog(tx, {
      userId,
      action: 'mandadito_registered',
      entity: 'cash_movement',
      entityId: expense.id,
      newValue: {
        amount: input.amount,
        saleId: input.saleId ?? null,
        paymentMethod: method.name,
        sessionId,
      },
    });
    return toExpense(expense);
  });
}

export async function listOrderMandaditos(db: PrismaClient, saleId: string) {
  await assertLocalSale(db, saleId);
  if (!(await db.sale.findUnique({ where: { id: saleId } })))
    throw new NotFoundError('El pedido no existe.');
  return (
    await db.cashMovement.findMany({
      where: { saleId, category: 'mandadito' },
      include,
      orderBy: { createdAt: 'desc' },
    })
  ).map(toExpense);
}
