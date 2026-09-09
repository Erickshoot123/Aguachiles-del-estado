import type {
  Category,
  CreateCategoryRequest,
  CreateProductRequest,
  Product,
  UpdateProductRequest,
} from '@aguachiles/shared';
import { apiRequest } from '../../lib/apiClient';

export function listCategories(token: string): Promise<Category[]> {
  return apiRequest<Category[]>('/api/categories', { token });
}

export function createCategory(token: string, input: CreateCategoryRequest): Promise<Category> {
  return apiRequest<Category>('/api/categories', { method: 'POST', body: input, token });
}

export function listCatalogProducts(token: string): Promise<Product[]> {
  return apiRequest<Product[]>('/api/products/catalog', { token });
}

export function createProduct(token: string, input: CreateProductRequest): Promise<Product> {
  return apiRequest<Product>('/api/products', { method: 'POST', body: input, token });
}

export function updateProduct(
  token: string,
  productId: string,
  input: UpdateProductRequest,
): Promise<Product> {
  return apiRequest<Product>(`/api/products/${productId}`, {
    method: 'PATCH',
    body: input,
    token,
  });
}
