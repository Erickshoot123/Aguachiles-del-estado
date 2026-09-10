import type { AnalyticsDashboard } from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';

export function getAnalyticsDashboard(from: string, to: string): Promise<AnalyticsDashboard> {
  const params = new URLSearchParams({ from, to });
  return authFetch<AnalyticsDashboard>(`/api/analytics/dashboard?${params.toString()}`);
}
