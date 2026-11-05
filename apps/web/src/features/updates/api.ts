import { authFetch } from '../../lib/authFetch';
export interface UpdateStatus {
  phase:
    | 'unavailable'
    | 'unconfigured'
    | 'idle'
    | 'checking'
    | 'current'
    | 'available'
    | 'downloading'
    | 'ready'
    | 'installing'
    | 'error';
  installedVersion: string | null;
  availableVersion?: string | null;
  releaseNotes?: string;
  bytes?: number;
  progress?: number;
  message?: string;
  checkedAt?: string | null;
}
export function getUpdateStatus(): Promise<UpdateStatus> {
  return authFetch('/api/updates/status');
}
export function updateAction(
  action: 'check' | 'download' | 'install',
  confirmed = false,
): Promise<UpdateStatus> {
  return authFetch('/api/updates/action', { method: 'POST', body: { action, confirmed } });
}
