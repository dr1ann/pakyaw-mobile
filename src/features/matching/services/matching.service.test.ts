import { describe, expect, it } from 'vitest';

import { geohashRangeEnd } from '@/features/matching/services/matching.service';

describe('geohashRangeEnd', () => {
  it('appends the  sentinel for Firestore prefix range', () => {
    expect(geohashRangeEnd('9q5')).toBe('9q5');
  });
});
