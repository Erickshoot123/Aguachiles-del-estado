import { z } from 'zod';

export const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const permissionCodeSchema = z.enum([
  'refunds.create',
  'cash.withdraw',
  'catalog.write',
  'suppliers.write',
  'reports.view',
  'audit.view',
  'users.manage',
]);
export type PermissionCode = z.infer<typeof permissionCodeSchema>;

export const PERMISSION_DESCRIPTIONS: Record<PermissionCode, string> = {
  'refunds.create': 'Procesar reembolsos',
  'cash.withdraw': 'Registrar retiros de caja',
  'catalog.write': 'Administrar el catálogo de productos y categorías',
  'suppliers.write': 'Administrar proveedores y compras',
  'reports.view': 'Ver reportes y analítica',
  'audit.view': 'Ver el historial de auditoría',
  'users.manage': 'Administrar las cuentas de usuario',
};

export function roleAllowsPermission(roleName: string, code: PermissionCode): boolean {
  return code !== 'users.manage' || roleName === 'admin';
}

export const BUILT_IN_ROLE_PERMISSIONS = {
  admin: permissionCodeSchema.options,
  gerente: permissionCodeSchema.options.filter((code) => roleAllowsPermission('gerente', code)),
  cajero: [],
} satisfies Record<string, readonly PermissionCode[]>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  username: z.string(),
  roleName: z.string(),
  permissions: z.array(permissionCodeSchema),
  mustChangePassword: z.boolean().optional(),
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

const newPasswordSchema = z
  .string()
  .min(6, 'La contraseña debe tener al menos 6 caracteres')
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    'La contraseña supera el límite de 72 bytes.',
  );

export const resetPasswordRequestSchema = z.object({ newPassword: newPasswordSchema });
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export const staffRoleSchema = z.enum(['gerente', 'cajero']);
export const createUserRequestSchema = z.object({
  name: z.string().trim().min(1, 'Ingresa el nombre.').max(100),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9._-]{3,40}$/,
      'Usa de 3 a 40 letras, números, puntos, guiones o guiones bajos.',
    ),
  roleName: staffRoleSchema,
  initialPassword: newPasswordSchema,
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const userStatusRequestSchema = z.object({ isActive: z.boolean() });

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual.'),
  newPassword: newPasswordSchema,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const userSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  username: z.string(),
  roleName: z.string(),
  isActive: z.boolean(),
});
export type UserSummary = z.infer<typeof userSummarySchema>;
