import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  CreateProductRequest,
  Product,
  ProductSummary,
  UpdateProductRequest,
} from '@aguachiles/shared';
import {
  DuplicateBarcodeError,
  DuplicateSkuError,
  ProductNotFoundError,
} from './products.errors.js';

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { category: true; inventory: true };
}>;

function toProductDto(product: ProductWithRelations): Product {
  return {
    id: product.id,
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    price: product.price.toNumber(),
    cost: product.cost.toNumber(),
    taxRate: product.taxRate.toNumber(),
    unit: product.unit,
    isActive: product.isActive,
    stock: product.inventory ? product.inventory.quantity.toNumber() : 0,
  };
}

export async function listActiveProductSummaries(prisma: PrismaClient): Promise<ProductSummary[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    price: product.price.toNumber(),
    unit: product.unit,
  }));
}

export async function listCatalogProducts(prisma: PrismaClient): Promise<Product[]> {
  const products = await prisma.product.findMany({
    include: { category: true, inventory: true },
    orderBy: { name: 'asc' },
  });

  return products.map(toProductDto);
}

async function assertUniqueSkuAndBarcode(
  prisma: PrismaClient,
  sku: string | undefined,
  barcode: string | null | undefined,
  excludeProductId?: string,
): Promise<void> {
  if (sku) {
    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing && existing.id !== excludeProductId) {
      throw new DuplicateSkuError();
    }
  }
  if (barcode) {
    const existing = await prisma.product.findUnique({ where: { barcode } });
    if (existing && existing.id !== excludeProductId) {
      throw new DuplicateBarcodeError();
    }
  }
}

export async function createProduct(
  prisma: PrismaClient,
  input: CreateProductRequest,
): Promise<Product> {
  await assertUniqueSkuAndBarcode(prisma, input.sku, input.barcode);

  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        sku: input.sku,
        barcode: input.barcode ?? null,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId,
        price: input.price,
        cost: input.cost,
        taxRate: input.taxRate,
        unit: input.unit,
      },
      include: { category: true },
    });

    const inventory = await tx.inventory.create({
      data: { productId: product.id, quantity: input.initialStock },
    });

    return { ...product, inventory };
  });

  return toProductDto(created);
}

export async function updateProduct(
  prisma: PrismaClient,
  productId: string,
  input: UpdateProductRequest,
): Promise<Product> {
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) {
    throw new ProductNotFoundError();
  }

  await assertUniqueSkuAndBarcode(prisma, input.sku, input.barcode, productId);

  const updated = await prisma.product.update({
    where: { id: productId },
    data: input,
    include: { category: true, inventory: true },
  });

  return toProductDto(updated);
}
