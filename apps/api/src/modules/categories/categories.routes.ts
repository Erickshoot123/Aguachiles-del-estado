import { createCategoryRequestSchema, updateCategoryRequestSchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { idParamSchema } from '../../lib/paramsSchemas.js';
import { createCategory, listCategories, updateCategory } from './categories.service.js';

export default async function categoriesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/categories', { preHandler: fastify.authenticate }, async (_request, reply) => {
    reply.status(200).send(await listCategories(fastify.prisma));
  });

  fastify.post('/api/categories', { preHandler: fastify.authenticate }, async (request, reply) => {
    const input = createCategoryRequestSchema.parse(request.body);
    const category = await createCategory(fastify.prisma, input);
    reply.status(201).send(category);
  });

  fastify.patch(
    '/api/categories/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const input = updateCategoryRequestSchema.parse(request.body);
      const category = await updateCategory(fastify.prisma, id, input);
      reply.status(200).send(category);
    },
  );
}
