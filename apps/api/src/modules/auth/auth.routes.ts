import {
  changePasswordRequestSchema,
  createUserRequestSchema,
  loginRequestSchema,
  refreshRequestSchema,
  resetPasswordRequestSchema,
  userStatusRequestSchema,
  type LoginResponse,
  type RefreshResponse,
} from '@aguachiles/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Env } from '../../config/env.js';
import { requirePermission } from '../../lib/authorize.js';
import { NotFoundError } from '../../lib/errors.js';
import { idParamSchema } from '../../lib/paramsSchemas.js';
import {
  changeOwnPassword,
  loginUser,
  revokeRefreshToken,
  rotateRefreshToken,
  toAuthUser,
  type AuthenticatedSession,
} from './auth.service.js';
import {
  createStaffUser,
  listUsers,
  resetUserPassword,
  setStaffUserActive,
} from './userManagement.service.js';

async function signSession(
  reply: FastifyReply,
  session: AuthenticatedSession,
): Promise<LoginResponse> {
  const { authUser, refreshToken, sessionVersion } = session;
  const accessToken = await reply.jwtSign({
    sub: authUser.id,
    roleName: authUser.roleName,
    permissions: authUser.permissions,
    sessionVersion,
  });
  return { accessToken, refreshToken, user: authUser };
}

export default async function authRoutes(
  fastify: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  const manageUsers = [fastify.authenticate, requirePermission('users.manage')];
  fastify.post(
    '/api/auth/login',
    {
      config: {
        rateLimit: {
          max: opts.env.LOGIN_RATE_LIMIT_MAX,
          timeWindow: opts.env.LOGIN_RATE_LIMIT_WINDOW_MS,
        },
      },
    },
    async (request, reply) => {
      const input = loginRequestSchema.parse(request.body);
      const session = await loginUser(fastify.prisma, input, opts.env.REFRESH_TOKEN_TTL_HOURS);
      const body: LoginResponse = await signSession(reply, session);
      reply.status(200).send(body);
    },
  );

  fastify.post('/api/auth/refresh', async (request, reply) => {
    const input = refreshRequestSchema.parse(request.body);
    const session = await rotateRefreshToken(
      fastify.prisma,
      input.refreshToken,
      opts.env.REFRESH_TOKEN_TTL_HOURS,
    );

    const body: RefreshResponse = await signSession(reply, session);
    reply.status(200).send(body);
  });

  fastify.post('/api/auth/logout', async (request, reply) => {
    const input = refreshRequestSchema.parse(request.body);
    await revokeRefreshToken(fastify.prisma, input.refreshToken);
    reply.status(204).send();
  });

  fastify.get('/api/auth/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.sub },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    reply.status(200).send(await toAuthUser(fastify.prisma, user));
  });

  fastify.post(
    '/api/auth/change-password',
    { preHandler: fastify.authenticateForPasswordChange },
    async (request, reply) => {
      const input = changePasswordRequestSchema.parse(request.body);
      await changeOwnPassword(
        fastify.prisma,
        request.user.sub,
        request.user.sessionVersion ?? 0,
        input,
      );
      reply.status(204).send();
    },
  );

  fastify.get('/api/auth/users', { preHandler: manageUsers }, async (_request, reply) => {
    reply.status(200).send(await listUsers(fastify.prisma));
  });

  fastify.post('/api/auth/users', { preHandler: manageUsers }, async (request, reply) => {
    const input = createUserRequestSchema.parse(request.body);
    reply.status(201).send(await createStaffUser(fastify.prisma, request.user.sub, input));
  });

  fastify.patch(
    '/api/auth/users/:id/status',
    { preHandler: manageUsers },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const { isActive } = userStatusRequestSchema.parse(request.body);
      await setStaffUserActive(fastify.prisma, request.user.sub, id, isActive);
      reply.status(204).send();
    },
  );

  fastify.post(
    '/api/auth/users/:id/reset-password',
    { preHandler: manageUsers },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const input = resetPasswordRequestSchema.parse(request.body);
      await resetUserPassword(fastify.prisma, request.user.sub, id, input.newPassword);
      reply.status(204).send();
    },
  );
}
