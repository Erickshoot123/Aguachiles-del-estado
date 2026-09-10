import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { CreatePurchaseRequest, Purchase, PurchaseLine } from '@aguachiles/shared';
import { ProductNotFoundError } from '../products/products.errors.js';
import { SupplierNotFoundError } from '../suppliers/suppliers.errors.js';

async function applyPurchaseLine(
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: number,
  purchaseId: string,
  supplierId: string,
  userId: string,
  reason: string | undefined,
): Promise<PurchaseLine> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    include: { inventory: true },
  });
  if (!product) {
    throw new ProductNotFoundError();
  }

  const previousStock = product.inventory?.quantity ?? new Prisma.Decimal(0);
  const addedQuantity = new Prisma.Decimal(quantity);
  const newStock = previousStock.add(addedQuantity);

  if (product.inventory) {
    await tx.inventory.update({ where: { productId }, data: { quantity: newStock } });
  } else {
    await tx.inventory.create({ data: { productId, quantity: newStock } });
  }

  await tx.inventoryMovement.create({
    data: {
      productId,
      type: 'purchase',
      quantity: addedQuantity,
      previousStock,
      newStock,
      referenceType: 'purchase_order',
      referenceId: purchaseId,
      supplierId,
      userId,
      reason,
    },
  });

  return {
    productId,
    productName: product.name,
    quantity: addedQuantity.toNumber(),
    newStock: newStock.toNumber(),
  };
}

export async function createPurchase(
  prisma: PrismaClient,
  userId: string,
  input: CreatePurchaseRequest,
): Promise<Purchase> {
  const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) {
    throw new SupplierNotFoundError();
  }

  const purchaseId = randomUUID();
  const lines = await prisma.$transaction(async (tx) => {
    const results: PurchaseLine[] = [];
    for (const item of input.items) {
      results.push(
        await applyPurchaseLine(
          tx,
          item.productId,
          item.quantity,
          purchaseId,
          input.supplierId,
          userId,
          input.reason,
        ),
      );
    }
    return results;
  });

  return {
    id: purchaseId,
    supplierId: supplier.id,
    supplierName: supplier.name,
    createdAt: new Date().toISOString(),
    lines,
  };
}

export async function listPurchases(prisma: PrismaClient): Promise<Purchase[]> {
  const movements = await prisma.inventoryMovement.findMany({
    where: { type: 'purchase' },
    include: { product: true, supplier: true },
    orderBy: { createdAt: 'desc' },
  });

  const grouped = new Map<string, Purchase>();
  for (const movement of movements) {
    if (!movement.referenceId || !movement.supplierId || !movement.supplier) {
      continue;
    }
    const line: PurchaseLine = {
      productId: movement.productId,
      productName: movement.product.name,
      quantity: movement.quantity.toNumber(),
      newStock: movement.newStock.toNumber(),
    };
    const existing = grouped.get(movement.referenceId);
    if (existing) {
      existing.lines.push(line);
      continue;
    }
    grouped.set(movement.referenceId, {
      id: movement.referenceId,
      supplierId: movement.supplierId,
      supplierName: movement.supplier.name,
      createdAt: movement.createdAt.toISOString(),
      lines: [line],
    });
  }
  return [...grouped.values()];
}
