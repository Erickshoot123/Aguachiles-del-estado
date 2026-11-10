import fastifyJwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import type { PermissionCode } from '@aguachiles/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Env } from '../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

export interface AuthTokenPayload {
  sub: string;
  roleName: string;
  permissions: PermissionCode[];
  sessionVersion?: number;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateForPasswordChange: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async function authPlugin(
  fastify: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  await fastify.register(fastifyJwt, {
    secret: opts.env.JWT_SECRET,
    sign: { expiresIn: opts.env.JWT_ACCESS_EXPIRES_IN },
  });

  async function verifySession(request: FastifyRequest) {
    await request.jwtVerify();
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { isActive: true, sessionVersion: true, mustChangePassword: true },
    });
    if (!user?.isActive || user.sessionVersion !== (request.user.sessionVersion ?? 0)) {
      throw new UnauthorizedError('La sesión ya no es válida. Vuelve a iniciar sesión.');
    }
    return user;
  }
  fastify.decorate('authenticateForPasswordChange', async (request: FastifyRequest) => {
    await verifySession(request);
  });
  fastify.decorate('authenticate', async (request: FastifyRequest) => {
    if ((await verifySession(request)).mustChangePassword) {
      throw new ForbiddenError('Cambia tu contraseña inicial antes de usar el POS.');
    }
  });
});
