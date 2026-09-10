import { createSupplierRequestSchema, updateSupplierRequestSchema } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../../lib/authorize.js';
import { idParamSchema } from '../../lib/paramsSchemas.js';
import { createSupplier, listSuppliers, updateSupplier } from './suppliers.service.js';

export default async function suppliersRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/suppliers',
    { preHandler: [fastify.authenticate, requirePermission('suppliers.write')] },
    async (_request, reply) => {
      reply.status(200).send(await listSuppliers(fastify.prisma));
    },
  );

  fastify.post(
    '/api/suppliers',
    { preHandler: [fastify.authenticate, requirePermission('suppliers.write')] },
    async (request, reply) => {
      const input = createSupplierRequestSchema.parse(request.body);
      const supplier = await createSupplier(fastify.prisma, input);
      reply.status(201).send(supplier);
    },
  );

  fastify.patch(
    '/api/suppliers/:id',
    { preHandler: [fastify.authenticate, requirePermission('suppliers.write')] },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const input = updateSupplierRequestSchema.parse(request.body);
      const supplier = await updateSupplier(fastify.prisma, id, input);
      reply.status(200).send(supplier);
    },
  );
}
