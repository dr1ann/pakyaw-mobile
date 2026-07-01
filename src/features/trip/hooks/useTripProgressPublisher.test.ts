import { describe, expect, it } from 'vitest';

import { shouldPublishTripProgress } from './useTripProgressPublisher';

describe('useTripProgressPublisher', () => {
  describe('shouldPublishTripProgress', () => {
    it('allows the first valid driver_arriving progress update', () => {
      expect(
        shouldPublishTripProgress({
          now: 10_000,
          lastPublishedAt: null,
          status: 'driver_arriving',
          remainingMeters: 1500,
          etaSeconds: 420,
        })
      ).toBe(true);
    });

    it('allows in_progress updates after roughly ten seconds', () => {
      expect(
        shouldPublishTripProgress({
          now: 20_000,
          lastPublishedAt: 10_000,
          status: 'in_progress',
          remainingMeters: 900,
          etaSeconds: 240,
        })
      ).toBe(true);
    });

    it('throttles updates before ten seconds have elapsed', () => {
      expect(
        shouldPublishTripProgress({
          now: 19_999,
          lastPublishedAt: 10_000,
          status: 'in_progress',
          remainingMeters: 900,
          etaSeconds: 240,
        })
      ).toBe(false);
    });

    it('rejects inactive statuses and invalid progress values', () => {
      expect(
        shouldPublishTripProgress({
          now: 10_000,
          lastPublishedAt: null,
          status: 'driver_arrived',
          remainingMeters: 100,
          etaSeconds: 30,
        })
      ).toBe(false);

      expect(
        shouldPublishTripProgress({
          now: 10_000,
          lastPublishedAt: null,
          status: 'in_progress',
          remainingMeters: null,
          etaSeconds: 30,
        })
      ).toBe(false);
    });
  });
});
