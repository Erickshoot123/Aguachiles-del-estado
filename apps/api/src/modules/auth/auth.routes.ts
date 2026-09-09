import { loginRequestSchema, refreshRequestSchema, type LoginResponse, type RefreshResponse } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import type { Env } from '../../config/env.js';
import { NotFoundError } from '../../lib/errors.js';
import { authenticateUser, issueRefreshToken, revokeRefreshToken, rotateRefreshToken } from './auth.service.js';

export default async function authRoutes(
  fastify: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  fastify.post('/api/auth/login', async (request, reply) => {
    const input = loginRequestSchema.parse(request.body);
    const { authUser } = await authenticateUser(fastify.prisma, input);

    const accessToken = await reply.jwtSign({ sub: authUser.id, roleName: authUser.roleName });
    const refreshToken = await issueRefreshToken(
      fastify.prisma,
      authUser.id,
      opts.env.REFRESH_TOKEN_TTL_HOURS,
    );

    const body: LoginResponse = { accessToken, refreshToken, user: authUser };
    reply.status(200).send(body);
  });

  fastify.post('/api/auth/refresh', async (request, reply) => {
    const input = refreshRequestSchema.parse(request.body);
    const { authUser, refreshToken } = await rotateRefreshToken(
      fastify.prisma,
      input.refreshToken,
      opts.env.REFRESH_TOKEN_TTL_HOURS,
    );

    const accessToken = await reply.jwtSign({ sub: authUser.id, roleName: authUser.roleName });

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

    reply.status(200).send({
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role.name,
    });
  });
}
