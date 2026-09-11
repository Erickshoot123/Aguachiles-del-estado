import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { AuthUser, LoginRequest, PermissionCode, UserSummary } from '@aguachiles/shared';
import { recordAuditLog } from '../audit/audit.service.js';
import { NotFoundError } from '../../lib/errors.js';
import { InactiveUserError, InvalidCredentialsError, InvalidRefreshTokenError } from './auth.errors.js';

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export interface AuthenticatedUser {
  authUser: AuthUser;
}

export async function getRolePermissions(
  prisma: PrismaClientOrTx,
  roleId: string,
): Promise<PermissionCode[]> {
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });
  return rolePermissions.map((rolePermission) => rolePermission.permission.code as PermissionCode);
}

export async function authenticateUser(
  prisma: PrismaClient,
  input: LoginRequest,
): Promise<AuthenticatedUser> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { role: true },
  });

  if (!user) {
    throw new InvalidCredentialsError();
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  if (!user.isActive) {
    throw new InactiveUserError();
  }

  const permissions = await getRolePermissions(prisma, user.roleId);

  return {
    authUser: {
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role.name,
      permissions,
    },
  };
}

function hashRefreshToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export async function issueRefreshToken(
  prisma: PrismaClientOrTx,
  userId: string,
  ttlHours: number,
): Promise<string> {
  const rawToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashRefreshToken(rawToken), expiresAt },
  });

  return rawToken;
}

export interface RotatedSession {
  authUser: AuthUser;
  refreshToken: string;
}

export async function rotateRefreshToken(
  prisma: PrismaClient,
  rawToken: string,
  ttlHours: number,
): Promise<RotatedSession> {
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(rawToken) },
    include: { user: { include: { role: true } } },
  });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw new InvalidRefreshTokenError();
  }
  if (!existing.user.isActive) {
    throw new InactiveUserError();
  }

  // Revocar el token viejo y emitir el nuevo en una sola transacción: si la
  // emisión falla por lo que sea, la revocación se revierte con ella y el
  // usuario conserva un token válido en vez de quedar con uno revocado y
  // ninguno nuevo (lo que forzaría un re-login innecesario).
  const newRawToken = await prisma.$transaction(async (tx) => {
    // updateMany con `revokedAt: null` en el where hace de la revocación una
    // operación atómica: si dos solicitudes concurrentes llegan con el mismo
    // token, solo una afecta una fila (count === 1); la otra ve count === 0
    // y falla, en vez de que ambas roten el mismo token una vez cada una.
    const revoked = await tx.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      throw new InvalidRefreshTokenError();
    }

    return issueRefreshToken(tx, existing.userId, ttlHours);
  });

  const permissions = await getRolePermissions(prisma, existing.user.roleId);

  return {
    authUser: {
      id: existing.user.id,
      name: existing.user.name,
      email: existing.user.email,
      roleName: existing.user.role.name,
      permissions,
    },
    refreshToken: newRawToken,
  };
}

export async function revokeRefreshToken(prisma: PrismaClient, rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function listUsers(prisma: PrismaClient): Promise<UserSummary[]> {
  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { name: 'asc' },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    roleName: user.role.name,
    isActive: user.isActive,
  }));
}

export async function resetUserPassword(
  prisma: PrismaClient,
  adminUserId: string,
  targetUserId: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) {
    throw new NotFoundError('Usuario no encontrado');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: targetUserId }, data: { passwordHash } });
    // Un reseteo de contraseña cierra todas las sesiones activas de ese
    // usuario: si alguien más tenía acceso con la contraseña vieja, un
    // refresh token vigente no debe seguir sirviendo para renovar sesión.
    await tx.refreshToken.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAuditLog(tx, {
      userId: adminUserId,
      action: 'user.password_reset',
      entity: 'user',
      entityId: targetUserId,
      newValue: { targetEmail: user.email },
    });
  });
}
