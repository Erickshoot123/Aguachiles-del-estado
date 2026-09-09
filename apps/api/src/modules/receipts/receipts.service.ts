import type { Prisma, PrismaClient } from '@prisma/client';
import type { Ticket, TicketFormat } from '@aguachiles/shared';
import { ReceiptNotFoundError } from './receipts.errors.js';

const BUSINESS_NAME = 'Aguachiles del Estado';

type SaleForReceipt = Prisma.SaleGetPayload<{
  include: { items: { include: { product: true } } };
}>;

export function buildTicket(sale: SaleForReceipt, format: TicketFormat): Ticket {
  return {
    saleId: sale.id,
    ticketNumber: sale.ticketNumber,
    format,
    issuedAt: new Date().toISOString(),
    businessName: BUSINESS_NAME,
    lines: sale.items.map((item) => ({
      productName: item.product.name,
      quantity: item.quantity.toNumber(),
      unitPrice: item.unitPrice.toNumber(),
      subtotal: item.subtotal.toNumber(),
    })),
    subtotal: sale.subtotal.toNumber(),
    taxTotal: sale.taxTotal.toNumber(),
    discountTotal: sale.discountTotal.toNumber(),
    total: sale.total.toNumber(),
    isReprint: false,
  };
}

export async function createReceiptForSale(
  tx: Prisma.TransactionClient,
  sale: SaleForReceipt,
): Promise<void> {
  const ticket = buildTicket(sale, 'thermal_80');
  await tx.receipt.create({
    data: {
      saleId: sale.id,
      format: 'thermal_80',
      contentSnapshot: ticket as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function getReceiptTicket(
  prisma: PrismaClient,
  saleId: string,
): Promise<{ ticket: Ticket; reprintCount: number }> {
  const receipt = await prisma.receipt.findUnique({ where: { saleId } });
  if (!receipt) {
    throw new ReceiptNotFoundError();
  }

  const ticket = receipt.contentSnapshot as unknown as Ticket;
  return {
    ticket: { ...ticket, isReprint: receipt.printedAt !== null },
    reprintCount: receipt.reprintCount,
  };
}

export async function recordPrinted(prisma: PrismaClient, saleId: string): Promise<void> {
  const receipt = await prisma.receipt.findUnique({ where: { saleId } });
  if (!receipt) {
    throw new ReceiptNotFoundError();
  }

  // updateMany condicionado a printedAt: null hace de la "primera impresión"
  // una operación atómica: ante dos confirmaciones casi simultáneas (doble
  // clic), solo una puede cumplir esa condición; la otra cae al incremento
  // de reprintCount en vez de que ambas marquen printedAt por separado.
  const markedFirstPrint = await prisma.receipt.updateMany({
    where: { saleId, printedAt: null },
    data: { printedAt: new Date() },
  });
  if (markedFirstPrint.count > 0) {
    return;
  }

  await prisma.receipt.update({ where: { saleId }, data: { reprintCount: { increment: 1 } } });
}
