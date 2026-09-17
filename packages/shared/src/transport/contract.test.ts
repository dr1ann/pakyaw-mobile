import { describe, expect, it } from 'vitest';

import {
  INITIAL_BILLED_SEATS,
  INITIAL_PASSENGER_COUNT,
  MAX_PASSENGER_COUNT,
  DEFAULT_PUBLIC_TRANSPORT_CONFIG,
  DEFAULT_SHARED_MAX_SEATS_PER_BOOKING,
  DEFAULT_SOLO_MIN_BILLED_SEATS,
  DEFAULT_VEHICLE_CAPACITY,
  LEGACY_SHARED_RIDES_COLLECTION,
  RIDE_MODES,
  SHARED_RIDES_COLLECTION,
  TRIP_OFFER_STATUSES,
  TRIP_STATUSES,
  isDriverPublicSnapshot,
  getFareSurchargeTotal,
  isFareBreakdown,
  isLegacyFareBreakdown,
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
    expect(isPassengerCountAllowed('shared', 4)).toBe(true);
    expect(isPassengerCountAllowed('shared', 4, { maxSeatsPerBooking: 3 })).toBe(false);
    expect(isPassengerCountAllowed('solo', 6, { vehicleCapacity: DEFAULT_VEHICLE_CAPACITY })).toBe(true);
    expect(isPassengerCountAllowed('solo', 7)).toBe(false);
    expect(MAX_PASSENGER_COUNT).toBe(6);
  });

  it('keeps the public defaults and fare snapshot shape aligned with Functions', () => {
    expect(DEFAULT_VEHICLE_CAPACITY).toBe(6);
    expect(DEFAULT_SOLO_MIN_BILLED_SEATS).toBe(4);
    expect(DEFAULT_SHARED_MAX_SEATS_PER_BOOKING).toBe(3);
    expect(DEFAULT_PUBLIC_TRANSPORT_CONFIG).toEqual({
      schemaVersion: 2,
      vehicleCapacity: 6,
      modes: {
        solo: { enabled: true, minPassengers: 1, maxPassengers: 6, minimumBilledSeats: 4, buyoutSeats: 4 },
        shared: { enabled: true, maxSeatsPerBooking: 3, maxSeats: 6 },
      },
      pricing: { currency: 'PHP' },
    });

    const fare = {
      perSeat: { baseFare: 10, succeedingKmCharge: 1, distanceFare: 2, surchargeTotal: 3, transportFare: 16 },
      billedSeats: 2,
      transportFare: 32,
      surcharges: { items: [{ code: 'night' as const, amount: 3, application: 'per_trip' as const }], total: 3 },
      serviceFee: { configuredAmount: 8, passengerPaid: 8, driverContribution: 0, driverBonus: 0, platformReceivable: 8 },
      feeTreatment: { scheme: 'full_pass_on' as const },
      passengerTotal: 40,
      platformReceivable: 8,
      configSchemaVersion: 2 as const,
      baseFare: 20,
      succeedingKmCharge: 2,
      distanceFare: 4,
      techFee: 8,
      total: 40,
      driverEarnings: 32,
    };
    expect(isFareBreakdown(fare)).toBe(true);
    expect(getFareSurchargeTotal(fare)).toBe(3);
    expect(isFareBreakdown({ baseFare: 20, distanceFare: 4, surcharges: 3, techFee: 8, total: 35 })).toBe(false);
    expect(isLegacyFareBreakdown({ baseFare: 20, distanceFare: 4, surcharges: 3, techFee: 8, total: 35 })).toBe(true);
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
