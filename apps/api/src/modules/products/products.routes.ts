import { createProductRequestSchema, updateProductRequestSchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../lib/authorize.js';
import { idParamSchema } from '../../lib/paramsSchemas.js';
import {
  createProduct,
  listActiveProductSummaries,
  listCatalogProducts,
  updateProduct,
} from './products.service.js';

export default async function productsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/products', { preHandler: fastify.authenticate }, async (_request, reply) => {
    reply.status(200).send(await listActiveProductSummaries(fastify.prisma));
  });

  fastify.get(
    '/api/products/catalog',
    { preHandler: [fastify.authenticate, requirePermission('catalog.write')] },
    async (_request, reply) => {
      reply.status(200).send(await listCatalogProducts(fastify.prisma));
    },
  );

  fastify.post(
    '/api/products',
    { preHandler: [fastify.authenticate, requirePermission('catalog.write')] },
    async (request, reply) => {
      const input = createProductRequestSchema.parse(request.body);
      const product = await createProduct(fastify.prisma, input);
      reply.status(201).send(product);
    },
  );

  fastify.patch(
    '/api/products/:id',
    { preHandler: [fastify.authenticate, requirePermission('catalog.write')] },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const input = updateProductRequestSchema.parse(request.body);
      const product = await updateProduct(fastify.prisma, id, request.user.sub, input);
      reply.status(200).send(product);
    },
  );
}
