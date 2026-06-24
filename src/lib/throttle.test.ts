import { describe, expect, it } from 'vitest';

import {
  shouldEmit,
  THROTTLE_MIN_DISTANCE_M,
  THROTTLE_MIN_INTERVAL_MS,
} from '@/lib/throttle';

const origin = { lat: 14.5995, lng: 120.9842 };

describe('throttle.shouldEmit', () => {
  it('emits when there is no prior sample', () => {
    expect(
      shouldEmit({ lastAt: null, lastGeo: null, now: 1_000, geo: origin }),
    ).toBe(true);
  });

  it('emits when the time gap meets the interval threshold', () => {
    expect(
      shouldEmit({
        lastAt: 0,
        lastGeo: origin,
        now: THROTTLE_MIN_INTERVAL_MS,
        geo: origin,
      }),
    ).toBe(true);
  });

  it('suppresses when both gates fail', () => {
    expect(
      shouldEmit({
        lastAt: 0,
        lastGeo: origin,
        now: THROTTLE_MIN_INTERVAL_MS - 1,
        geo: origin,
      }),
    ).toBe(false);
  });

  it('emits when the distance gate is satisfied even with a small time delta', () => {
    const far = { lat: origin.lat + 0.001, lng: origin.lng };
    expect(
      shouldEmit({ lastAt: 0, lastGeo: origin, now: 100, geo: far }),
    ).toBe(true);
  });

  it('exposes the documented thresholds', () => {
    expect(THROTTLE_MIN_INTERVAL_MS).toBe(4_000);
    expect(THROTTLE_MIN_DISTANCE_M).toBe(25);
  });
});
