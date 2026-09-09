import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import type { AuthUser, LoginRequest } from '@aguachiles/shared';
import { InactiveUserError, InvalidCredentialsError } from './auth.errors.js';

export interface AuthenticatedUser {
  authUser: AuthUser;
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

  return {
    authUser: {
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role.name,
    },
  };
}
