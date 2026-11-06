import type { Prisma } from '@prisma/client';
import { ConflictError, ForbiddenError } from '../../lib/errors.js';

export async function getLocalLocation(db: Prisma.TransactionClient) {
  const node = await db.localNode.findUnique({ where: { id: 'local' }, include: { location: true } });
  if (node) {
    if (!node.location.isActive) throw new ConflictError('La sucursal local está desactivada');
    return node.location;
  }
  const locations = await db.location.findMany({ where: { isActive: true }, take: 2 });
  if (locations.length !== 1) {
    throw new ConflictError('Configura la sucursal de esta instalación antes de operar');
  }
  return locations[0]!;
}

export async function assertLocalRegister(db: Prisma.TransactionClient, registerId: string): Promise<void> {
  const location = await getLocalLocation(db);
  const register = await db.cashRegister.findUnique({ where: { id: registerId } });
  if (!register || register.locationId !== location.id) {
    throw new ForbiddenError('La caja no pertenece a esta sucursal');
  }
}

export async function assertLocalSale(db: Prisma.TransactionClient, saleId: string): Promise<void> {
  const location = await getLocalLocation(db);
  const sale = await db.sale.findUnique({ where: { id: saleId } });
  if (sale && sale.locationId !== location.id) throw new ForbiddenError('El pedido pertenece a otra sucursal');
}
