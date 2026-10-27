import { Prisma, type PrismaClient } from '@prisma/client';
import { cashSessionPayloadSchema, type BranchReport, type BranchReportQuery, type BranchSummary } from '@aguachiles/shared';
import { readBranches, readBranchTotals, readOpenSessions, readRecentClosings, type BranchTotals } from './branches.repository.js';

function formatTotals(totals?: BranchTotals) {
  const zero = new Prisma.Decimal(0);
  const gross = totals?.gross ?? zero;
  const refunded = totals?.refunds ?? zero;
  const tickets = Number(totals?.tickets ?? 0n);
  return {
    grossSales: gross.toFixed(2), refunds: refunded.toFixed(2), netSales: gross.sub(refunded).toFixed(2),
    tickets, averageTicket: tickets ? gross.div(tickets).toFixed(2) : '0.00',
    payments: { cash: (totals?.cash ?? zero).toFixed(2), card: (totals?.card ?? zero).toFixed(2),
      transfer: (totals?.transfer ?? zero).toFixed(2), other: (totals?.other ?? zero).toFixed(2) },
  };
}

export async function getBranchReport(db: PrismaClient, query: BranchReportQuery): Promise<BranchReport> {
  // Un snapshot evita combinar un lote nuevo de pagos con el estado anterior de ventas.
  return db.$transaction(async (tx) => {
    const branches = await readBranches(tx, query.installationId);
    const totals = await readBranchTotals(tx, query);
    const open = await readOpenSessions(tx, query.installationId);
    const result: BranchSummary[] = await Promise.all(branches.map(async (branch) => ({
      ...branch, lastSeenAt: branch.lastSeenAt?.toISOString() ?? null,
      openSessions: open.find((row) => row.installationId === branch.id)?._count ?? 0,
      ...formatTotals(totals.find((row) => row.installationId === branch.id)),
      recentClosings: await getRecentClosings(tx, branch.id),
    })));
    return { branches: result, generatedAt: new Date().toISOString() };
  }, { isolationLevel: 'RepeatableRead' });
}

async function getRecentClosings(db: Prisma.TransactionClient, installationId: string) {
  const rows = await readRecentClosings(db, installationId);
  return rows.map((row) => {
    const { closedAt, expectedAmount, actualAmount, difference } = cashSessionPayloadSchema.parse(row.payload);
    return { id: row.entityId, closedAt, expectedAmount, actualAmount, difference };
  });
}
