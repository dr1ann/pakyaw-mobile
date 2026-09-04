import { describe, expect, it } from 'vitest';

import {
  INITIAL_BILLED_SEATS,
  INITIAL_PASSENGER_COUNT,
  LEGACY_SHARED_RIDES_COLLECTION,
  RIDE_MODES,
  SHARED_RIDES_COLLECTION,
  TRIP_OFFER_STATUSES,
  TRIP_STATUSES,
  isDriverPublicSnapshot,
  isPassengerCountAllowed,
  isRideMode,
} from './contract';

describe('transport contract', () => {
  it('accepts only canonical ride modes', () => {
    expect(RIDE_MODES).toEqual(['solo', 'shared']);
    expect(RIDE_MODES.every((mode) => isRideMode(mode))).toBe(true);
    expect(['private', 'hop', 'hopon', 'hop_on', 'pakyaw'].some((mode) => isRideMode(mode))).toBe(false);
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

  it('keeps the initial seat policy explicit while runtime config owns limits', () => {
    expect(INITIAL_PASSENGER_COUNT).toBe(1);
    expect(INITIAL_BILLED_SEATS).toBe(1);
    expect(isPassengerCountAllowed('shared', 1)).toBe(true);
    expect(isPassengerCountAllowed('shared', 2)).toBe(true);
    expect(isPassengerCountAllowed('shared', 3)).toBe(true);
    expect(isPassengerCountAllowed('shared', 4)).toBe(false);
    expect(isPassengerCountAllowed('solo', 6)).toBe(true);
    expect(isPassengerCountAllowed('solo', 7)).toBe(false);
  });

  it('names sharedRides as canonical and shared_rides as legacy', () => {
    expect(SHARED_RIDES_COLLECTION).toBe('sharedRides');
    expect(LEGACY_SHARED_RIDES_COLLECTION).toBe('shared_rides');
  });

  it('accepts only the backend-generated Passenger-safe Driver snapshot', () => {
    const snapshot = {
      driverId: 'driver-1',
      displayName: 'Ada Driver',
      profilePhotoUrl: null,
      vehicle: {
        type: 'tricycle',
        description: 'Blue tricycle',
        plateNumber: 'ABC-1234',
        unitBodyNumber: 'UNIT-001',
      },
      verification: { verified: true as const },
    };

    expect(isDriverPublicSnapshot(snapshot)).toBe(true);
    expect(isDriverPublicSnapshot({ name: 'Legacy driver', plateNumber: 'ABC-1234' })).toBe(false);
    expect(isDriverPublicSnapshot({ ...snapshot, licenseNumber: 'PRIVATE' })).toBe(false);
  });
});
