import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePurchaseRequest } from '@aguachiles/shared';
import { useIsLoggedIn } from '../auth/authStore';
import { CATALOG_PRODUCTS_QUERY_KEY } from '../catalog/hooks';
import { createPurchase, listPurchases } from './api';

const PURCHASES_QUERY_KEY = ['purchases'] as const;

export function usePurchases() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: PURCHASES_QUERY_KEY,
    queryFn: listPurchases,
    enabled: isLoggedIn,
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePurchaseRequest) => createPurchase(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PURCHASES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: CATALOG_PRODUCTS_QUERY_KEY });
    },
  });
}
