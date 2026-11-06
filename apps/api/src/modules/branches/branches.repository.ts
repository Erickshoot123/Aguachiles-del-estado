import { Prisma } from '@prisma/client';
import type { BranchReportQuery } from '@aguachiles/shared';

export interface BranchTotals {
  installationId: string; gross: Prisma.Decimal; refunds: Prisma.Decimal; tickets: bigint;
  cash: Prisma.Decimal; card: Prisma.Decimal; transfer: Prisma.Decimal; other: Prisma.Decimal;
}

export async function readBranchTotals(db: Prisma.TransactionClient, query: BranchReportQuery) {
  const branchFilter = query.installationId ? Prisma.sql`AND r.installation_id = ${query.installationId}` : Prisma.empty;
  return db.$queryRaw<BranchTotals[]>`
    SELECT r.installation_id AS "installationId",
      COALESCE(sum(amount) FILTER (WHERE kind = 'payment'), 0) AS gross,
      COALESCE(sum(amount) FILTER (WHERE kind = 'refund' AND status = 'completed'), 0) AS refunds,
      count(*) FILTER (WHERE kind = 'sale' AND status IN ('completed','refunded','partially_refunded')) AS tickets,
      COALESCE(sum(amount) FILTER (WHERE kind = 'payment' AND payment_type = 'cash'), 0) AS cash,
      COALESCE(sum(amount) FILTER (WHERE kind = 'payment' AND payment_type = 'card'), 0) AS card,
      COALESCE(sum(amount) FILTER (WHERE kind = 'payment' AND payment_type = 'transfer'), 0) AS transfer,
      COALESCE(sum(amount) FILTER (WHERE kind = 'payment' AND payment_type = 'other'), 0) AS other
    FROM sync_records r JOIN sync_installations b ON b.id = r.installation_id
    WHERE NOT r.deleted
      AND ((r.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE b.time_zone)::date
        BETWEEN ${query.from}::date AND ${query.to}::date ${branchFilter}
    GROUP BY r.installation_id`;
}

export async function readBranches(db: Prisma.TransactionClient, installationId?: string) {
  return db.syncInstallation.findMany({ where: installationId ? { id: installationId } : {}, orderBy: { name: 'asc' },
    select: { id: true, name: true, timeZone: true, isActive: true, lastSeenAt: true, pendingCount: true } });
}

export async function readOpenSessions(db: Prisma.TransactionClient, installationId?: string) {
  return db.syncRecord.groupBy({ by: ['installationId'], where: {
    kind: 'cashSession', status: 'open', deleted: false, ...(installationId ? { installationId } : {}),
  }, _count: true });
}

export async function readRecentClosings(db: Prisma.TransactionClient, installationId: string) {
  return db.syncRecord.findMany({ where: { installationId, kind: 'cashSession', status: 'closed', deleted: false },
    orderBy: { occurredAt: 'desc' }, take: 5 });
}
