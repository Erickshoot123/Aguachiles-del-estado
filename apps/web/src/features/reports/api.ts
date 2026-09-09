import type { CashSessionHistoryItem, SalesReport } from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';

export function getSalesReport(from: string, to: string): Promise<SalesReport> {
  const params = new URLSearchParams({ from, to });
  return authFetch<SalesReport>(`/api/reports/sales?${params.toString()}`);
}

export function getCashSessionHistory(): Promise<CashSessionHistoryItem[]> {
  return authFetch<CashSessionHistoryItem[]>('/api/reports/cash-sessions');
}
