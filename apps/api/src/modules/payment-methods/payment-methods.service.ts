import type { PaymentMethod as PrismaPaymentMethod, PrismaClient } from '@prisma/client';
import type { PaymentMethod } from '@aguachiles/shared';

function toPaymentMethodDto(paymentMethod: PrismaPaymentMethod): PaymentMethod {
  return {
    id: paymentMethod.id,
    name: paymentMethod.name,
    type: paymentMethod.type,
  };
}

export async function listActivePaymentMethods(prisma: PrismaClient): Promise<PaymentMethod[]> {
  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  return paymentMethods.map(toPaymentMethodDto);
}
