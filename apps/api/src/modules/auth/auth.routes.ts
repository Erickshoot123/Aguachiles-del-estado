import {
  loginRequestSchema,
  refreshRequestSchema,
  resetPasswordRequestSchema,
  type LoginResponse,
  type RefreshResponse,
} from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import type { Env } from '../../config/env.js';
import { requirePermission } from '../../lib/authorize.js';
import { NotFoundError } from '../../lib/errors.js';
import { idParamSchema } from '../../lib/paramsSchemas.js';
import {
  authenticateUser,
  getRolePermissions,
  issueRefreshToken,
  listUsers,
  resetUserPassword,
  revokeRefreshToken,
  rotateRefreshToken,
} from './auth.service.js';

export default async function authRoutes(
  fastify: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
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
      const { authUser } = await authenticateUser(fastify.prisma, input);

      const accessToken = await reply.jwtSign({
        sub: authUser.id,
        roleName: authUser.roleName,
        permissions: authUser.permissions,
      });
      const refreshToken = await issueRefreshToken(
        fastify.prisma,
        authUser.id,
        opts.env.REFRESH_TOKEN_TTL_HOURS,
      );

      const body: LoginResponse = { accessToken, refreshToken, user: authUser };
      reply.status(200).send(body);
    },
  );

  fastify.post('/api/auth/refresh', async (request, reply) => {
    const input = refreshRequestSchema.parse(request.body);
    const { authUser, refreshToken } = await rotateRefreshToken(
      fastify.prisma,
      input.refreshToken,
      opts.env.REFRESH_TOKEN_TTL_HOURS,
    );

    const accessToken = await reply.jwtSign({
      sub: authUser.id,
      roleName: authUser.roleName,
      permissions: authUser.permissions,
    });

    const body: RefreshResponse = { accessToken, refreshToken, user: authUser };
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

    const permissions = await getRolePermissions(fastify.prisma, user.roleId);

    reply.status(200).send({
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role.name,
      permissions,
    });
  });

  fastify.get(
    '/api/auth/users',
    { preHandler: [fastify.authenticate, requirePermission('users.manage')] },
    async (_request, reply) => {
      reply.status(200).send(await listUsers(fastify.prisma));
    },
  );

  fastify.post(
    '/api/auth/users/:id/reset-password',
    { preHandler: [fastify.authenticate, requirePermission('users.manage')] },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const input = resetPasswordRequestSchema.parse(request.body);
      await resetUserPassword(fastify.prisma, request.user.sub, id, input.newPassword);
      reply.status(204).send();
    },
  );
}
