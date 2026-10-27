import type { BranchReport, BranchReportQuery, SyncStatus } from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';

export function fetchBranchReport(query: BranchReportQuery): Promise<BranchReport> {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.installationId) params.set('installationId', query.installationId);
  return authFetch(`/api/branches/report?${params.toString()}`);
}
export function fetchSyncStatus(): Promise<SyncStatus> { return authFetch('/api/sync/status'); }
