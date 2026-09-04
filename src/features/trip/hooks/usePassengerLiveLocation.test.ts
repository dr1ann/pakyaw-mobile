import { describe, it, expect } from 'vitest';
import { formatPassengerToPickupDistance, STALE_LOCATION_THRESHOLD_MS } from './usePassengerLiveLocation';

describe('formatPassengerToPickupDistance', () => {
  it('returns null for null, undefined, or negative values', () => {
    expect(formatPassengerToPickupDistance(null)).toBeNull();
    expect(formatPassengerToPickupDistance(-5)).toBeNull();
    expect(formatPassengerToPickupDistance(NaN)).toBeNull();
  });

  it('returns near pickup for small distances (< 50m)', () => {
    expect(formatPassengerToPickupDistance(0)).toBe('Passenger is near the pickup');
    expect(formatPassengerToPickupDistance(25)).toBe('Passenger is near the pickup');
    expect(formatPassengerToPickupDistance(49.9)).toBe('Passenger is near the pickup');
  });

  it('formats meter distances (< 1000m)', () => {
    expect(formatPassengerToPickupDistance(50)).toBe('Passenger is ~50 m from pickup');
    expect(formatPassengerToPickupDistance(85.4)).toBe('Passenger is ~85 m from pickup');
    expect(formatPassengerToPickupDistance(999)).toBe('Passenger is ~999 m from pickup');
  });

  it('formats kilometer distances (>= 1000m)', () => {
    expect(formatPassengerToPickupDistance(1000)).toBe('Passenger is 1.0 km from pickup');
    expect(formatPassengerToPickupDistance(1500)).toBe('Passenger is 1.5 km from pickup');
    expect(formatPassengerToPickupDistance(2800)).toBe('Passenger is 2.8 km from pickup');
  });

  it('has a 60 second stale threshold', () => {
    expect(STALE_LOCATION_THRESHOLD_MS).toBe(60000);
  });
});
