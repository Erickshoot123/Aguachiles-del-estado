import type {
  CreateSupplierRequest,
  Supplier,
  SupplierRow,
  UpdateSupplierRequest,
} from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';

export function listSuppliers(): Promise<(Supplier | SupplierRow)[]> {
  return authFetch<(Supplier | SupplierRow)[]>('/api/suppliers');
}

export function createSupplier(input: CreateSupplierRequest): Promise<Supplier> {
  return authFetch<Supplier>('/api/suppliers', { method: 'POST', body: input });
}

export function updateSupplier(
  supplierId: string,
  input: UpdateSupplierRequest,
): Promise<Supplier> {
  return authFetch<Supplier>(`/api/suppliers/${supplierId}`, { method: 'PATCH', body: input });
}
