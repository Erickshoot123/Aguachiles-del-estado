import type { Category as PrismaCategory, PrismaClient } from '@prisma/client';
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '@aguachiles/shared';
import { CategoryNotFoundError, DuplicateCategoryNameError } from './categories.errors.js';

function toCategoryDto(category: PrismaCategory): Category {
  return {
    id: category.id,
    name: category.name,
    parentId: category.parentId,
    isActive: category.isActive,
  };
}

export async function listCategories(prisma: PrismaClient): Promise<Category[]> {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  return categories.map(toCategoryDto);
}

export async function createCategory(
  prisma: PrismaClient,
  input: CreateCategoryRequest,
): Promise<Category> {
  const parentId = input.parentId ?? null;
  const existing = await prisma.category.findFirst({ where: { name: input.name, parentId } });
  if (existing) {
    throw new DuplicateCategoryNameError();
  }

  const created = await prisma.category.create({ data: { name: input.name, parentId } });
  return toCategoryDto(created);
}

export async function updateCategory(
  prisma: PrismaClient,
  categoryId: string,
  input: UpdateCategoryRequest,
): Promise<Category> {
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) {
    throw new CategoryNotFoundError();
  }

  if (input.name && input.name !== existing.name) {
    const duplicate = await prisma.category.findFirst({
      where: { name: input.name, parentId: existing.parentId },
    });
    if (duplicate) {
      throw new DuplicateCategoryNameError();
    }
  }

  const updated = await prisma.category.update({ where: { id: categoryId }, data: input });
  return toCategoryDto(updated);
}
