import { z } from 'zod';
import { saleStatusSchema } from './orders.js';

const money = z.string().regex(/^-?\d{1,10}(\.\d{1,2})?$/);
const timestamp = z.string().datetime({ offset: true });
const paymentType = z.enum(['cash', 'card', 'transfer', 'other']);
const basePayload = z.object({ amount: money, occurredAt: timestamp });
export const cashSessionPayloadSchema = basePayload.extend({
  registerId: z.string().uuid(), status: z.enum(['open', 'closed']),
  expectedAmount: money.nullable(), actualAmount: money.nullable(), difference: money.nullable(),
  closedAt: timestamp.nullable(),
});
const eventBase = z.object({
  sequence: z.string().regex(/^[1-9]\d{0,18}$/).refine((value) => BigInt(value) <= 9223372036854775807n),
  entityId: z.string().uuid(), locationId: z.string().uuid(), deleted: z.boolean(),
});
export const syncEventSchema = z.discriminatedUnion('kind', [
  eventBase.extend({ kind: z.literal('sale'), payload: basePayload.extend({
    ticketNumber: z.string().min(1).max(100), status: saleStatusSchema,
  }) }),
  eventBase.extend({ kind: z.literal('payment'), payload: basePayload.extend({
    saleId: z.string().uuid(), paymentType,
  }) }),
  eventBase.extend({ kind: z.literal('refund'), payload: basePayload.extend({
    saleId: z.string().uuid(), status: z.enum(['pending', 'completed']),
  }) }),
  eventBase.extend({ kind: z.literal('cashSession'), payload: cashSessionPayloadSchema }),
  eventBase.extend({ kind: z.literal('cashMovement'), payload: basePayload.extend({
    sessionId: z.string().uuid(), type: z.enum(['sale_income', 'withdrawal', 'deposit', 'expense', 'refund']),
    paymentType: paymentType.nullable(),
  }) }),
]);
export type SyncEvent = z.infer<typeof syncEventSchema>;
export const syncBatchSchema = z.object({
  protocolVersion: z.literal(1), events: z.array(syncEventSchema).max(100),
  pendingCount: z.number().int().min(0).max(2147483647),
});
export type SyncBatch = z.infer<typeof syncBatchSchema>;
export const syncAckSchema = z.object({ accepted: z.array(z.string()), receivedAt: timestamp });
export type SyncAck = z.infer<typeof syncAckSchema>;

export interface SyncStatus {
  mode: 'local' | 'central'; locationName: string | null; enabled: boolean;
  pendingCount: number; lastSuccessAt: string | null; lastError: string | null;
}
export const branchReportQuerySchema = z.object({
  from: z.string().date(), to: z.string().date(), installationId: z.string().uuid().optional(),
}).refine((query) => query.from <= query.to &&
  (Date.parse(query.to) - Date.parse(query.from)) / 86400000 <= 366,
{ message: 'Selecciona un periodo de hasta 366 días, con inicio anterior al fin' });
export type BranchReportQuery = z.infer<typeof branchReportQuerySchema>;
export interface BranchSummary {
  id: string; name: string; timeZone: string; isActive: boolean;
  lastSeenAt: string | null; pendingCount: number | null;
  grossSales: string; refunds: string; netSales: string; tickets: number; averageTicket: string;
  openSessions: number; payments: Record<'cash' | 'card' | 'transfer' | 'other', string>;
  recentClosings: { id: string; closedAt: string | null; expectedAmount: string | null;
    actualAmount: string | null; difference: string | null }[];
}
export interface BranchReport { branches: BranchSummary[]; generatedAt: string }
