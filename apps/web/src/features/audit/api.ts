import type { AuditLogEntry } from '@aguachiles/shared';
import { authFetch } from '../../lib/authFetch';

export function listAuditLogs(): Promise<AuditLogEntry[]> {
  return authFetch<AuditLogEntry[]>('/api/audit-logs');
}
