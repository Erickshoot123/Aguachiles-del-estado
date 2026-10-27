import { Prisma, type PrismaClient } from '@prisma/client';
import type { ChargePayment, Order } from '@aguachiles/shared';
import { NoOpenCashSessionError } from '../cash/cash.errors.js';
import { createReceiptForSale } from '../receipts/receipts.service.js';
import { assertLocalSale, assertLocalRegister } from '../locations/localLocation.repository.js';
import { OrderNotFoundError, OrderAlreadyChargedError, PaymentAmountMismatchError, PaymentMethodNotFoundError } from './orders.errors.js';
import { toOrderDto } from './orderDto.js';

async function applyChargePayments(
  tx: Prisma.TransactionClient,
  saleId: string,
  saleTotal: Prisma.Decimal,
  cashSessionId: string,
  userId: string,
  payments: ChargePayment[],
): Promise<void> {
  const paymentMethods = await tx.paymentMethod.findMany({
    where: { id: { in: payments.map((payment) => payment.paymentMethodId) }, isActive: true },
  });
  const paymentMethodById = new Map(paymentMethods.map((method) => [method.id, method]));

  const paidTotal = payments.reduce(
    (sum, payment) => sum.add(new Prisma.Decimal(payment.amount)),
    new Prisma.Decimal(0),
  );
  if (!paidTotal.equals(saleTotal)) {
    throw new PaymentAmountMismatchError();
  }

  for (const payment of payments) {
    const method = paymentMethodById.get(payment.paymentMethodId);
    if (!method) {
      throw new PaymentMethodNotFoundError();
    }
    const amount = new Prisma.Decimal(payment.amount);
    await tx.salePayment.create({
      data: { saleId, paymentMethodId: method.id, amount, reference: payment.reference },
    });
    await tx.cashMovement.create({
      data: { sessionId: cashSessionId, type: 'sale_income', paymentMethodId: method.id, amount, userId },
    });
  }
}

export async function chargeOrder(
  prisma: PrismaClient,
  orderId: string,
  userId: string,
  cashSessionId: string,
  payments: ChargePayment[],
): Promise<Order> {
  const order = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sales WHERE id = ${orderId} FOR UPDATE`;
    await assertLocalSale(tx, orderId);
    const sale = await tx.sale.findUnique({ where: { id: orderId } });
    if (!sale) {
      throw new OrderNotFoundError();
    }
    if (sale.status !== 'pending') {
      throw new OrderAlreadyChargedError();
    }

    await tx.$queryRaw`SELECT id FROM cash_register_sessions WHERE id = ${cashSessionId} FOR UPDATE`;
    const cashSession = await tx.cashRegisterSession.findUnique({ where: { id: cashSessionId } });
    if (!cashSession || cashSession.status !== 'open') {
      throw new NoOpenCashSessionError();
    }
    await assertLocalRegister(tx, cashSession.cashRegisterId);

    await applyChargePayments(tx, sale.id, sale.total, cashSessionId, userId, payments);

    const updatedSale = await tx.sale.update({
      where: { id: orderId },
      data: { status: 'completed', paidAt: new Date(), cashRegisterSessionId: cashSessionId },
      include: { items: { include: { product: true } } },
    });

    await createReceiptForSale(tx, updatedSale);

    return updatedSale;
  });

  return toOrderDto(order);
}

