import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSupplierRequest, UpdateSupplierRequest } from '@aguachiles/shared';
import { useIsLoggedIn, usePermission } from '../auth/authStore';
import { createSupplier, listSuppliers, updateSupplier } from './api';

const SUPPLIERS_QUERY_KEY = ['suppliers'] as const;

export function useSuppliers() {
  const isLoggedIn = useIsLoggedIn();
  const canEdit = usePermission('suppliers.write');

  return useQuery({
    queryKey: [...SUPPLIERS_QUERY_KEY, canEdit],
    queryFn: listSuppliers,
    enabled: isLoggedIn,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSupplierRequest) => createSupplier(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ supplierId, input }: { supplierId: string; input: UpdateSupplierRequest }) =>
      updateSupplier(supplierId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY });
    },
  });
}
