import { loginRequestSchema, type LoginResponse } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { authenticateUser } from './auth.service.js';

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/auth/login', async (request, reply) => {
    const input = loginRequestSchema.parse(request.body);
    const { authUser } = await authenticateUser(fastify.prisma, input);

    const accessToken = await reply.jwtSign({ sub: authUser.id, roleName: authUser.roleName });

    const body: LoginResponse = { accessToken, user: authUser };
    reply.status(200).send(body);
  });

  fastify.get(
    '/api/auth/me',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.sub },
        include: { role: true },
      });

      if (!user) {
        reply.status(404).send({ code: 'NOT_FOUND', message: 'Usuario no encontrado' });
        return;
      }

      reply.status(200).send({
        id: user.id,
        name: user.name,
        email: user.email,
        roleName: user.role.name,
      });
    },
  );
}
