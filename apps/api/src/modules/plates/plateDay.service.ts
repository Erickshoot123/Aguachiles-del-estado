import type { PrismaClient } from '@prisma/client';
import type { AdjustPlates, InitializePlates, PlateAvailability } from '@aguachiles/shared';
import { ConflictError } from '../../lib/errors.js';
import { getLocalLocation } from '../locations/localLocation.repository.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { plateBusinessDate } from './plateDate.js';
import { lockPlateDay, plateAvailabilityDto } from './plateDay.repository.js';

export async function getPlateAvailability(db: PrismaClient): Promise<PlateAvailability> {
  const location = await getLocalLocation(db);
  const date = plateBusinessDate();
  const day = await db.plateDay.findUnique({ where: { locationId_businessDate: { locationId: location.id, businessDate: date } } });
  return plateAvailabilityDto(date, day);
}

export async function initializePlates(db: PrismaClient, userId: string, input: InitializePlates): Promise<PlateAvailability> {
  return db.$transaction(async (tx) => {
    const { id: locationId } = await getLocalLocation(tx);
    const date = plateBusinessDate();
    await lockPlateDay(tx, locationId, date);
    if (await tx.plateDay.findUnique({ where: { locationId_businessDate: { locationId, businessDate: date } } })) {
      throw new ConflictError('La disponibilidad de hoy ya fue registrada. Usa Ajustar platos.');
    }
    const day = await tx.plateDay.create({ data: { locationId, businessDate: date,
      initialKilo: input.kilo, initialHalf: input.halfKilo, kiloLimit: input.kilo, halfLimit: input.halfKilo } });
    await recordAuditLog(tx, { userId, action: 'plates.initialize', entity: 'plate_day', entityId: day.id,
      newValue: { date, ...input } });
    return plateAvailabilityDto(date, day);
  });
}

export async function adjustPlates(db: PrismaClient, userId: string, input: AdjustPlates): Promise<PlateAvailability> {
  return db.$transaction(async (tx) => {
    const { id: locationId } = await getLocalLocation(tx);
    const date = plateBusinessDate();
    await lockPlateDay(tx, locationId, date);
    const day = await tx.plateDay.findUnique({ where: { locationId_businessDate: { locationId, businessDate: date } } });
    if (!day) throw new ConflictError('Primero registra los platos iniciales de hoy.');
    const previousRequest = input.requestId ? await tx.auditLog.findUnique({ where: { id: input.requestId } }) : null;
    if (previousRequest) {
      const applied = previousRequest.newValue as Record<string, unknown> | null;
      if (previousRequest.action !== 'plates.adjust' || previousRequest.entityId !== day.id || previousRequest.userId !== userId
        || applied?.kiloDelta !== input.kiloDelta || applied?.halfKiloDelta !== input.halfKiloDelta || applied?.reason !== input.reason) {
        throw new ConflictError('La solicitud de ajuste ya se utilizó con otros datos. Actualiza la pantalla.');
      }
      return plateAvailabilityDto(date, day);
    }
    const kiloLimit = day.kiloLimit + input.kiloDelta;
    const halfLimit = day.halfLimit + input.halfKiloDelta;
    if (kiloLimit < day.kiloSold + day.kiloReserved || halfLimit < day.halfSold + day.halfReserved) {
      throw new ConflictError('No puedes quitar más platos de los que quedan disponibles.');
    }
    if (kiloLimit > 100000 || halfLimit > 100000) throw new ConflictError('El límite diario es 100000 platos por presentación.');
    const updated = await tx.plateDay.update({ where: { id: day.id }, data: { kiloLimit, halfLimit } });
    await recordAuditLog(tx, { id: input.requestId, userId, action: 'plates.adjust', entity: 'plate_day', entityId: day.id,
      oldValue: { kilo: day.kiloLimit, halfKilo: day.halfLimit },
      newValue: { kilo: kiloLimit, halfKilo: halfLimit, ...input } });
    return plateAvailabilityDto(date, updated);
  });
}
