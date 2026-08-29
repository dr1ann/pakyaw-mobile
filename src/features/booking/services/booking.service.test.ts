import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceAreaError, TripDistanceTooShortError } from '@/lib/serviceArea';

const mocks = vi.hoisted(() => ({
  callable: vi.fn(),
  httpsCallable: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: mocks.httpsCallable,
}));

vi.mock('@/services/firebase/firebase', () => ({ functions: {} }));

vi.mock('@pakyaw/shared/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { createTrip } from './booking.service';

describe('booking.service — createTrip()', () => {
  const validRoute = {
    distanceMeters: 3400,
    durationSeconds: 480,
    polyline: 'abcdef_encoded_polyline',
  };
  const validInput = {
    mode: 'solo' as const,
    pickup: {
      label: 'Ormoc Superdome',
      address: 'Ormoc, Leyte',
      coords: { lat: 11.005, lng: 124.6075 },
    },
    destination: {
      label: 'Brgy Cogon',
      address: 'Cogon, Ormoc',
      coords: { lat: 11.01, lng: 124.615 },
    },
    passengerCount: 3,
    route: validRoute,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.httpsCallable.mockReturnValue(mocks.callable);
    mocks.callable.mockResolvedValue({
      data: { tripId: 'mock-trip-id-123', status: 'requested', offeredDriverCount: 2 },
    });
  });

  it('requests a server-authoritative trip with canonical coordinates', async () => {
    await expect(createTrip(validInput, 'passenger-uid-123')).resolves.toBe('mock-trip-id-123');

    expect(mocks.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'requestTrip');
    expect(mocks.callable).toHaveBeenCalledWith({
      passengerId: 'passenger-uid-123',
      mode: 'solo',
      pickup: { latitude: 11.005, longitude: 124.6075, label: 'Ormoc Superdome' },
      destination: { latitude: 11.01, longitude: 124.615, label: 'Brgy Cogon' },
      route: validRoute,
      passengerCount: 3,
      displayedFare: null,
    });
  });

  it('never calls the server when a location is outside the service area', async () => {
    await expect(createTrip({
      ...validInput,
      pickup: { ...validInput.pickup, coords: { lat: 11.2444, lng: 125.0039 } },
    }, 'passenger-uid-123')).rejects.toThrow(ServiceAreaError);
    expect(mocks.callable).not.toHaveBeenCalled();
  });

  it('never calls the server for a route shorter than 50 metres', async () => {
    await expect(createTrip({
      ...validInput,
      route: { ...validRoute, distanceMeters: 49 },
    }, 'passenger-uid-123')).rejects.toThrow(TripDistanceTooShortError);
    expect(mocks.callable).not.toHaveBeenCalled();
  });

  it('rejects a malformed callable response instead of inventing a trip id', async () => {
    mocks.callable.mockResolvedValue({ data: { tripId: '', status: 'requested', offeredDriverCount: 0 } });

    await expect(createTrip(validInput, 'passenger-uid-123')).rejects.toThrow('Could not create your trip');
  });
});
