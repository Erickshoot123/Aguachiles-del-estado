import { createHash, timingSafeEqual } from 'node:crypto';

export function hashSyncToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function matchesSyncToken(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSyncToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
