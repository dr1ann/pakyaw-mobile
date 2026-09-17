import { describe, expect, it } from 'vitest';
import { isCurrentTripDocument, parseTripDocument } from './read';

const fare = {
  perSeat: { baseFare: 50, succeedingKmCharge: 0, distanceFare: 0, surchargeTotal: 0, transportFare: 50 },
  billedSeats: 1,
  transportFare: 50,
  surcharges: { items: [], total: 0 },
  serviceFee: { configuredAmount: 5, passengerPaid: 5, driverContribution: 0, driverBonus: 0, platformReceivable: 5 },
  feeTreatment: { scheme: 'full_pass_on' },
  passengerTotal: 55,
  platformReceivable: 5,
  configSchemaVersion: 2,
  baseFare: 50,
  succeedingKmCharge: 0,
  distanceFare: 0,
  techFee: 5,
  total: 55,
  driverEarnings: 50,
} as const;

const canonical = {
  schemaVersion: 1,
  passengerId: 'passenger-1',
  driverId: null,
  mode: 'solo',
  status: 'requested',
  pickup: { latitude: 11.005, longitude: 124.6075, label: 'Pickup' },
  destination: { latitude: 11.012, longitude: 124.615, label: 'Destination' },
  route: { distanceMeters: 3400, durationSeconds: 480, polyline: 'route' },
  passengerCount: 1,
  billedSeats: 1,
  fare,
  requestedAt: { seconds: 100, nanoseconds: 0 },
};

describe('trip runtime reader', () => {
  it('accepts a marked canonical trip and preserves the authoritative fields', () => {
    const parsed = parseTripDocument('trip-1', canonical);

    expect(parsed?.kind).toBe('canonical');
    expect(parsed?.trip.mode).toBe('solo');
    expect(parsed?.trip.fare).toBe(55);
    expect(parsed?.trip.route?.distanceMeters).toBe(3400);
  });

  it('rejects a marked malformed current trip instead of applying legacy defaults', () => {
    const malformed = {
      ...canonical,
      mode: 'invalid',
      fare: { total: 55 },
      passengerCount: '1',
    };

    expect(isCurrentTripDocument(malformed)).toBe(true);
    expect(parseTripDocument('trip-invalid', malformed)).toBeNull();
  });

  it('keeps defaults isolated to an unmarked historical record', () => {
    const parsed = parseTripDocument('legacy-1', {
      passengerId: 'passenger-1',
      pickup: { address: 'Old pickup' },
      destination: { address: 'Old destination' },
    });

    expect(parsed?.kind).toBe('legacy');
    expect(parsed?.trip.mode).toBe('solo');
    expect(parsed?.trip.status).toBe('requested');
    expect(parsed?.trip.passengerCount).toBe(1);
    expect(parsed?.historyMode).toBe('solo');
  });

  it('drops malformed public driver identity without exposing legacy aliases', () => {
    const parsed = parseTripDocument('trip-driver', {
      ...canonical,
      driverPublic: { name: 'Legacy driver', plateNumber: 'FAKE-1' },
    });

    expect(parsed?.trip.driverPublic).toBeNull();
    expect(parsed?.driver).toBeNull();
  });
});
