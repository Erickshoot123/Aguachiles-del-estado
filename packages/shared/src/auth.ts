import { z } from 'zod';

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const permissionCodeSchema = z.enum([
  'refunds.create',
  'cash.withdraw',
  'catalog.write',
  'suppliers.write',
  'reports.view',
  'audit.view',
]);
export type PermissionCode = z.infer<typeof permissionCodeSchema>;

export const PERMISSION_DESCRIPTIONS: Record<PermissionCode, string> = {
  'refunds.create': 'Procesar reembolsos',
  'cash.withdraw': 'Registrar retiros de caja',
  'catalog.write': 'Administrar el catálogo de productos y categorías',
  'suppliers.write': 'Administrar proveedores y compras',
  'reports.view': 'Ver reportes y analítica',
  'audit.view': 'Ver el historial de auditoría',
};

export const authUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  roleName: z.string(),
  permissions: z.array(permissionCodeSchema),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: authUserSchema,
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: authUserSchema,
});

export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
