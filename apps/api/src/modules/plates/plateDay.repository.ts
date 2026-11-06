import type { PlateDay, Prisma } from '@prisma/client';
import type { PlateAvailability } from '@aguachiles/shared';

export async function lockPlateDay(tx: Prisma.TransactionClient, locationId: string, date: string): Promise<void> {
  const key = `plates:${locationId}:${date}`;
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

export function plateAvailabilityDto(date: string, day: PlateDay | null): PlateAvailability {
  return { date, initialized: day !== null, buckets: [
    { size: 'kilo', initial: day?.initialKilo ?? 0, limit: day?.kiloLimit ?? 0,
      reserved: day?.kiloReserved ?? 0, sold: day?.kiloSold ?? 0,
      available: day ? day.kiloLimit - day.kiloReserved - day.kiloSold : 0 },
    { size: 'half_kilo', initial: day?.initialHalf ?? 0, limit: day?.halfLimit ?? 0,
      reserved: day?.halfReserved ?? 0, sold: day?.halfSold ?? 0,
      available: day ? day.halfLimit - day.halfReserved - day.halfSold : 0 },
  ] };
}
