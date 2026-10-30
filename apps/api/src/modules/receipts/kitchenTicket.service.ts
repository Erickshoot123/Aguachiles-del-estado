import type { PrismaClient } from '@prisma/client';
import type { Ticket } from '@aguachiles/shared';
import { assertLocalSale } from '../locations/localLocation.repository.js';
import { buildTicket } from './receipts.service.js';
import { ReceiptNotFoundError } from './receipts.errors.js';

export async function getKitchenTicket(prisma: PrismaClient, saleId: string): Promise<Ticket> {
  await assertLocalSale(prisma, saleId);
  const sale = await prisma.sale.findUnique({
    where: { id: saleId }, include: { items: { include: { product: true } } },
  });
  if (!sale) throw new ReceiptNotFoundError();
  return {
    ...buildTicket(sale, 'thermal_58'), purpose: 'kitchen',
    issuedAt: sale.createdAt.toISOString(),
    channelLabel: sale.channel === 'delivery' ? 'Entrega a domicilio' : 'Mostrador',
    notes: sale.notes, whatsappUrl: null,
  };
}
