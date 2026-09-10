import type { PrismaClient, Supplier as PrismaSupplier } from '@prisma/client';
import type { CreateSupplierRequest, Supplier, UpdateSupplierRequest } from '@aguachiles/shared';
import { SupplierNotFoundError } from './suppliers.errors.js';

function toSupplierDto(supplier: PrismaSupplier): Supplier {
  return {
    id: supplier.id,
    name: supplier.name,
    contactName: supplier.contactName,
    phone: supplier.phone,
    email: supplier.email,
    taxId: supplier.taxId,
    isActive: supplier.isActive,
  };
}

export async function listSuppliers(prisma: PrismaClient): Promise<Supplier[]> {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  return suppliers.map(toSupplierDto);
}

export async function createSupplier(
  prisma: PrismaClient,
  input: CreateSupplierRequest,
): Promise<Supplier> {
  const created = await prisma.supplier.create({
    data: {
      name: input.name,
      contactName: input.contactName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      taxId: input.taxId ?? null,
    },
  });
  return toSupplierDto(created);
}

export async function updateSupplier(
  prisma: PrismaClient,
  supplierId: string,
  input: UpdateSupplierRequest,
): Promise<Supplier> {
  const existing = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!existing) {
    throw new SupplierNotFoundError();
  }
  const updated = await prisma.supplier.update({ where: { id: supplierId }, data: input });
  return toSupplierDto(updated);
}
