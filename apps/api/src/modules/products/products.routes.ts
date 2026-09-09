import type { ProductSummary } from '@aguachiles/shared';
import type { FastifyInstance } from 'fastify';

export default async function productsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/products', { preHandler: fastify.authenticate }, async (_request, reply) => {
    const products = await fastify.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const body: ProductSummary[] = products.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price.toNumber(),
      unit: product.unit,
    }));

    reply.status(200).send(body);
  });
}
