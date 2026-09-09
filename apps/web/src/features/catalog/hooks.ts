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
  const isLoggedIn = useAuthStore((state) => Boolean(state.accessToken));

  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: listCategories,
    enabled: isLoggedIn,
  });
}

export function useCatalogProducts() {
  const isLoggedIn = useAuthStore((state) => Boolean(state.accessToken));

  return useQuery({
    queryKey: CATALOG_PRODUCTS_QUERY_KEY,
    queryFn: listCatalogProducts,
    enabled: isLoggedIn,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryRequest) => createCategory(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProductRequest) => createProduct(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATALOG_PRODUCTS_QUERY_KEY });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: UpdateProductRequest }) =>
      updateProduct(productId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATALOG_PRODUCTS_QUERY_KEY });
    },
  });
}
