import type {
  Category,
  CreateCategoryRequest,
  CreateProductRequest,
  Product,
  UpdateProductRequest,
} from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';

export function listCategories(): Promise<Category[]> {
  return authFetch<Category[]>('/api/categories');
}

export function createCategory(input: CreateCategoryRequest): Promise<Category> {
  return authFetch<Category>('/api/categories', { method: 'POST', body: input });
}

export function listCatalogProducts(): Promise<Product[]> {
  return authFetch<Product[]>('/api/products/catalog');
}

export function createProduct(input: CreateProductRequest): Promise<Product> {
  return authFetch<Product>('/api/products', { method: 'POST', body: input });
}

export function updateProduct(productId: string, input: UpdateProductRequest): Promise<Product> {
  return authFetch<Product>(`/api/products/${productId}`, { method: 'PATCH', body: input });
}
