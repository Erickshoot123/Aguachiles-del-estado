import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCategoryRequest,
  CreateInventoryAdjustmentRequest,
  CreateProductRequest,
  UpdateProductRequest,
} from '@aguachiles/shared';
import { useIsLoggedIn } from '../auth/authStore';
import {
  adjustInventory,
  createCategory,
  createProduct,
  listCatalogProducts,
  listCategories,
  updateProduct,
} from './api';

const CATEGORIES_QUERY_KEY = ['categories'] as const;
export const CATALOG_PRODUCTS_QUERY_KEY = ['products', 'catalog'] as const;
// El catálogo cambia con poca frecuencia (a diferencia del tablero de
// pedidos); evita refetch en cada focus/mount mientras el usuario navega.
const CATALOG_STALE_TIME_MS = 60_000;

export function useCategories() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: listCategories,
    enabled: isLoggedIn,
    staleTime: CATALOG_STALE_TIME_MS,
  });
}

export function useCatalogProducts() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: CATALOG_PRODUCTS_QUERY_KEY,
    queryFn: listCatalogProducts,
    enabled: isLoggedIn,
    staleTime: CATALOG_STALE_TIME_MS,
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

export function useAdjustInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productId,
      input,
    }: {
      productId: string;
      input: CreateInventoryAdjustmentRequest;
    }) => adjustInventory(productId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATALOG_PRODUCTS_QUERY_KEY });
    },
  });
}
