import { expect, it } from 'vitest';
import { plateBusinessDate } from './plateDate.js';

it('cambia de jornada a medianoche local, no a medianoche UTC', () => {
  const previous = process.env.POS_TIME_ZONE;
  process.env.POS_TIME_ZONE = 'America/Mazatlan';
  try {
    expect(plateBusinessDate(new Date('2026-10-30T06:59:59Z'))).toBe('2026-10-29');
    expect(plateBusinessDate(new Date('2026-10-30T07:00:00Z'))).toBe('2026-10-30');
  } finally {
    if (previous === undefined) delete process.env.POS_TIME_ZONE;
    else process.env.POS_TIME_ZONE = previous;
  }
});
