import { Prisma, type PrismaClient } from '@prisma/client';
import type { CreateUserRequest, UserSummary } from '@aguachiles/shared';
import bcrypt from 'bcryptjs';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { revokeUserRefreshTokens } from './auth.service.js';

const userSummaryFields = {
  id: true,
  name: true,
  username: true,
  isActive: true,
  role: { select: { name: true } },
} satisfies Prisma.UserSelect;

function toUserSummary({
  role,
  ...user
}: Prisma.UserGetPayload<{ select: typeof userSummaryFields }>): UserSummary {
  return { ...user, roleName: role.name };
}

export async function listUsers(prisma: PrismaClient): Promise<UserSummary[]> {
  const users = await prisma.user.findMany({ select: userSummaryFields, orderBy: { name: 'asc' } });
  return users.map(toUserSummary);
}

export async function createStaffUser(
  prisma: PrismaClient,
  adminId: string,
  input: CreateUserRequest,
): Promise<UserSummary> {
  const duplicate = await prisma.user.findFirst({
    where: { username: { equals: input.username, mode: 'insensitive' } },
    select: { id: true },
  });
  if (duplicate) throw new ConflictError('Ese nombre de usuario ya está en uso.');
  const role = await prisma.role.findUnique({
    where: { name: input.roleName },
    select: { id: true },
  });
  if (!role) throw new ConflictError('El rol seleccionado no está disponible en esta instalación.');
  const passwordHash = await bcrypt.hash(input.initialPassword, 12);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.name,
          username: input.username,
          roleId: role.id,
          passwordHash,
          mustChangePassword: true,
        },
        select: userSummaryFields,
      });
      const summary = toUserSummary(user);
      await recordAuditLog(tx, {
        userId: adminId,
        action: 'user.created',
        entity: 'user',
        entityId: user.id,
        newValue: { targetUsername: user.username, role: summary.roleName },
      });
      return summary;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Ese nombre de usuario ya está en uso.');
    }
    throw error;
  }
}

export async function setStaffUserActive(
  prisma: PrismaClient,
  adminId: string,
  targetUserId: string,
  isActive: boolean,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: targetUserId },
      select: userSummaryFields,
    });
    if (!user) throw new NotFoundError('Usuario no encontrado');
    if (user.role.name === 'admin')
      throw new ForbiddenError('La cuenta de Administrador está protegida.');

    const updated = await tx.user.updateMany({
      where: { id: targetUserId, isActive: !isActive },
      data: { isActive, sessionVersion: { increment: 1 } },
    });
    if (updated.count === 0) return;
    await revokeUserRefreshTokens(tx, targetUserId);
    await recordAuditLog(tx, {
      userId: adminId,
      action: isActive ? 'user.activated' : 'user.deactivated',
      entity: 'user',
      entityId: targetUserId,
      newValue: { targetUsername: user.username, isActive },
    });
  });
}

export async function resetUserPassword(
  prisma: PrismaClient,
  adminId: string,
  targetUserId: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { username: true },
  });
  if (!user) throw new NotFoundError('Usuario no encontrado');
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetUserId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await revokeUserRefreshTokens(tx, targetUserId);
    await recordAuditLog(tx, {
      userId: adminId,
      action: 'user.password_reset',
      entity: 'user',
      entityId: targetUserId,
      newValue: { targetUsername: user.username },
    });
  });
}
