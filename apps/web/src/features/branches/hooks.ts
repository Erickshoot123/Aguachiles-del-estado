import { useQuery } from '@tanstack/react-query';
import type { BranchReportQuery } from '@aguachiles/shared';
import { fetchBranchReport, fetchSyncStatus } from './api';

export function useBranchReport(query: BranchReportQuery) {
  return useQuery({ queryKey: ['branches', query], queryFn: () => fetchBranchReport(query), refetchInterval: 15000 });
}
export function useSyncStatus() {
  return useQuery({ queryKey: ['sync-status'], queryFn: fetchSyncStatus, refetchInterval: 15000 });
}
