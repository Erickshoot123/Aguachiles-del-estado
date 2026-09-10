import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditLogEntry } from '@aguachiles/shared';

type AuditClient = PrismaClient | Prisma.TransactionClient;

interface RecordAuditLogInput {
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}

export async function recordAuditLog(client: AuditClient, input: RecordAuditLogInput): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      oldValue: input.oldValue,
      newValue: input.newValue,
    },
  });
}

type AuditLogWithUser = Prisma.AuditLogGetPayload<{ include: { user: true } }>;

function toAuditLogDto(log: AuditLogWithUser): AuditLogEntry {
  return {
    id: log.id,
    userId: log.userId,
    userName: log.user?.name ?? null,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    oldValue: log.oldValue,
    newValue: log.newValue,
    createdAt: log.createdAt.toISOString(),
  };
}

const AUDIT_LOG_LIMIT = 200;

export async function listAuditLogs(prisma: PrismaClient): Promise<AuditLogEntry[]> {
  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: AUDIT_LOG_LIMIT,
  });
  return logs.map(toAuditLogDto);
}
