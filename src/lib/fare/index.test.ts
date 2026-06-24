import { describe, expect, it } from 'vitest';

import { computeFare } from './index';

describe('computeFare', () => {
  it('returns null (deferred pricing)', () => {
    const result = computeFare({
      barangay: 'San Lorenzo',
      billedSeats: 4,
      riderType: 'regular',
      surcharges: [],
    });
    expect(result).toBeNull();
  });
});
