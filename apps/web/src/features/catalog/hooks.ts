import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCategoryRequest,
  CreateProductRequest,
  UpdateProductRequest,
} from '@aguachiles/shared';
import { useAuthStore } from '../auth/authStore';
import {
  createCategory,
  createProduct,
  listCatalogProducts,
  listCategories,
  updateProduct,
} from './api';

const CATEGORIES_QUERY_KEY = ['categories'] as const;
const CATALOG_PRODUCTS_QUERY_KEY = ['products', 'catalog'] as const;

export function useCategories() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: () => listCategories(accessToken as string),
    enabled: Boolean(accessToken),
  });
}

export function useCatalogProducts() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: CATALOG_PRODUCTS_QUERY_KEY,
    queryFn: () => listCatalogProducts(accessToken as string),
    enabled: Boolean(accessToken),
  });
}

export function useCreateCategory() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryRequest) => createCategory(accessToken as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
  });
}

export function useCreateProduct() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProductRequest) => createProduct(accessToken as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATALOG_PRODUCTS_QUERY_KEY });
    },
  });
}

export function useUpdateProduct() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: UpdateProductRequest }) =>
      updateProduct(accessToken as string, productId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATALOG_PRODUCTS_QUERY_KEY });
    },
  });
}
