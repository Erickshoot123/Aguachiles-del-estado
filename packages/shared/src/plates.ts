import { z } from 'zod';

export const plateSizeSchema = z.enum(['kilo', 'half_kilo']);
export type PlateSize = z.infer<typeof plateSizeSchema>;
export const initializePlatesSchema = z.object({
  kilo: z.number().int().min(0).max(100000),
  halfKilo: z.number().int().min(0).max(100000),
});
export const adjustPlatesSchema = z.object({
  requestId: z.string().uuid().optional(),
  kiloDelta: z.number().int().min(-100000).max(100000),
  halfKiloDelta: z.number().int().min(-100000).max(100000),
  reason: z.string().trim().min(1).max(300),
}).refine((input) => input.kiloDelta !== 0 || input.halfKiloDelta !== 0, 'Ingresa un ajuste');
export type InitializePlates = z.infer<typeof initializePlatesSchema>;
export type AdjustPlates = z.infer<typeof adjustPlatesSchema>;
export interface PlateBucket {
  size: PlateSize; initial: number; limit: number; reserved: number; sold: number; available: number;
}
export interface PlateAvailability { date: string; initialized: boolean; buckets: PlateBucket[] }
