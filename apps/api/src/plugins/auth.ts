import fastifyJwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Env } from '../config/env.js';

export interface AuthTokenPayload {
  sub: string;
  roleName: string;
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
  }
}

export default fp(async function authPlugin(fastify: FastifyInstance, opts: { env: Env }): Promise<void> {
  await fastify.register(fastifyJwt, {
    secret: opts.env.JWT_SECRET,
    sign: { expiresIn: opts.env.JWT_ACCESS_EXPIRES_IN },
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    await request.jwtVerify();
  });
});
