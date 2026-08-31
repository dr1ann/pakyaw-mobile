import { describe, expect, it } from 'vitest';

import {
  INITIAL_BILLED_SEATS,
  INITIAL_PASSENGER_COUNT,
  LEGACY_SHARED_RIDES_COLLECTION,
  RIDE_MODES,
  SHARED_RIDES_COLLECTION,
  TRIP_OFFER_STATUSES,
  TRIP_STATUSES,
  isPassengerCountAllowed,
  isRideMode,
} from './contract';

describe('transport contract', () => {
  it('accepts only canonical ride modes', () => {
    expect(RIDE_MODES).toEqual(['solo', 'shared', 'hop']);
    expect(RIDE_MODES.every((mode) => isRideMode(mode))).toBe(true);
    expect(['private', 'hopon', 'hop_on', 'pakyaw'].some((mode) => isRideMode(mode))).toBe(false);
  });

  it('keeps the canonical trip and offer status unions', () => {
    expect(TRIP_STATUSES).toEqual([
      'requested',
      'accepted',
      'driver_arriving',
      'driver_arrived',
      'in_progress',
      'completed',
      'cancelled',
    ]);
    expect(TRIP_OFFER_STATUSES).toEqual(['pending', 'accepted', 'expired']);
  });

  it('keeps the initial Hop seat policy explicit while runtime config owns limits', () => {
    expect(INITIAL_PASSENGER_COUNT).toBe(1);
    expect(INITIAL_BILLED_SEATS).toBe(1);
    expect(isPassengerCountAllowed('hop', 1)).toBe(true);
    expect(isPassengerCountAllowed('hop', 2)).toBe(true);
  });

  it('names sharedRides as canonical and shared_rides as legacy', () => {
    expect(SHARED_RIDES_COLLECTION).toBe('sharedRides');
    expect(LEGACY_SHARED_RIDES_COLLECTION).toBe('shared_rides');
  });
});
