import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  AuthUser,
  ChangePasswordRequest,
  LoginRequest,
  PermissionCode,
} from '@aguachiles/shared';
import { recordAuditLog } from '../audit/audit.service.js';
import { ValidationError } from '../../lib/errors.js';
import {
  InactiveUserError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
} from './auth.errors.js';

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;
const userWithRole = { role: true } satisfies Prisma.UserInclude;
type UserWithRole = Prisma.UserGetPayload<{ include: typeof userWithRole }>;

export interface AuthenticatedSession {
  authUser: AuthUser;
  refreshToken: string;
  sessionVersion: number;
}

export async function toAuthUser(prisma: PrismaClientOrTx, user: UserWithRole): Promise<AuthUser> {
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: user.roleId },
    include: { permission: true },
  });
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    roleName: user.role.name,
    permissions: rolePermissions.map(({ permission }) => permission.code as PermissionCode),
    mustChangePassword: user.mustChangePassword,
  };
}

function hashRefreshToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

async function createSession(
  tx: Prisma.TransactionClient,
  user: UserWithRole,
  ttlHours: number,
): Promise<AuthenticatedSession> {
  const refreshToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const authUser = await toAuthUser(tx, user);
  await tx.refreshToken.create({
    data: { userId: user.id, tokenHash: hashRefreshToken(refreshToken), expiresAt },
  });
  return { authUser, refreshToken, sessionVersion: user.sessionVersion };
}

async function lockUserForSession(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<UserWithRole> {
  // Serializa la emisión de sesiones con los cambios de contraseña y de estado de la cuenta.
  await tx.$queryRaw`SELECT 1 FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: userId }, include: userWithRole });
  if (!user) throw new InvalidRefreshTokenError();
  if (!user.isActive) throw new InactiveUserError();
  return user;
}

export async function loginUser(
  prisma: PrismaClient,
  input: LoginRequest,
  ttlHours: number,
): Promise<AuthenticatedSession> {
  const select = { id: true, passwordHash: true, sessionVersion: true } as const;
  const candidate =
    (await prisma.user.findUnique({ where: { username: input.username }, select })) ??
    (await prisma.user.findUnique({
      where: { username: input.username.trim().toLowerCase() },
      select,
    }));
  if (!candidate || !(await bcrypt.compare(input.password, candidate.passwordHash))) {
    throw new InvalidCredentialsError();
  }
  return prisma.$transaction(async (tx) => {
    const user = await lockUserForSession(tx, candidate.id);
    if (user.sessionVersion !== candidate.sessionVersion) throw new InvalidCredentialsError();
    return createSession(tx, user, ttlHours);
  });
}

export async function rotateRefreshToken(
  prisma: PrismaClient,
  rawToken: string,
  ttlHours: number,
): Promise<AuthenticatedSession> {
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(rawToken) },
  });
  if (!existing || existing.revokedAt || existing.expiresAt <= new Date())
    throw new InvalidRefreshTokenError();

  return prisma.$transaction(async (tx) => {
    const user = await lockUserForSession(tx, existing.userId);
    const revoked = await tx.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) throw new InvalidRefreshTokenError();
    return createSession(tx, user, ttlHours);
  });
}

export async function revokeRefreshToken(prisma: PrismaClient, rawToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeUserRefreshTokens(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function changeOwnPassword(
  prisma: PrismaClient,
  userId: string,
  sessionVersion: number,
  input: ChangePasswordRequest,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.isActive || user.sessionVersion !== sessionVersion)
    throw new InvalidRefreshTokenError();
  if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw new ValidationError('La contraseña actual es incorrecta.');
  }
  if (input.currentPassword === input.newPassword) {
    throw new ValidationError('La contraseña nueva debe ser distinta a la actual.');
  }
  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, sessionVersion, isActive: true },
      data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } },
    });
    if (updated.count === 0) throw new InvalidRefreshTokenError();
    await revokeUserRefreshTokens(tx, userId);
    await recordAuditLog(tx, {
      userId,
      action: 'user.password_changed',
      entity: 'user',
      entityId: userId,
    });
  });
}
