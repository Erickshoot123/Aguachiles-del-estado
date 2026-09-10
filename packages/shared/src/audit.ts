import { z } from 'zod';

export const auditLogEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  userName: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  oldValue: z.unknown().nullable(),
  newValue: z.unknown().nullable(),
  createdAt: z.string().datetime(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;
