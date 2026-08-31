import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callable: vi.fn(),
  httpsCallable: vi.fn(),
  onSnapshot: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_firestore, name: string) => name),
  onSnapshot: mocks.onSnapshot,
  query: vi.fn((...constraints: unknown[]) => constraints),
  where: vi.fn((field: string, operator: string, value: unknown) => ({ field, operator, value })),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: mocks.httpsCallable,
}));

vi.mock('@/services/firebase/firebase', () => ({
  firestore: {},
  functions: {},
}));

vi.mock('@pakyaw/shared/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

import { acceptTripOffer, declineTripOffer, subscribeDriverOffers } from '@/features/matching/services/matching.service';

describe('matching.service — server offers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.httpsCallable.mockReturnValue(mocks.callable);
    mocks.onSnapshot.mockReturnValue(mocks.unsubscribe);
  });

  it('streams only valid, unexpired offers assigned to the signed-in driver', () => {
    const onOffers = vi.fn();
    const onError = vi.fn();
    mocks.onSnapshot.mockImplementation((_query, onNext) => {
      onNext({
        docs: [
          {
            id: 'offer-live',
            data: () => ({
              tripId: 'trip-1',
              status: 'pending',
              mode: 'solo',
              passengerCount: 2,
              billedSeats: 2,
              pickup: { latitude: 11.0, longitude: 124.6, label: 'Pickup' },
              destination: { latitude: 11.1, longitude: 124.7, label: 'Destination' },
              fare: { total: 125, driverEarnings: 120 },
              offeredAt: { toMillis: () => 1_700_000_000_000 },
              expiresAt: { toMillis: () => Date.now() + 30_000 },
            }),
          },
          {
            id: 'offer-expired',
            data: () => ({
              tripId: 'trip-2',
              status: 'pending',
              mode: 'solo',
              passengerCount: 1,
              billedSeats: 1,
              pickup: { latitude: 11.0, longitude: 124.6 },
              destination: { latitude: 11.1, longitude: 124.7 },
              expiresAt: { toMillis: () => Date.now() - 1 },
            }),
          },
        ],
      });
      return mocks.unsubscribe;
    });

    const unsubscribe = subscribeDriverOffers('driver-1', onOffers, onError);

    expect(onOffers).toHaveBeenCalledWith([
      expect.objectContaining({
        offerId: 'offer-live',
        tripId: 'trip-1',
        mode: 'solo',
        passengerCount: 2,
        billedSeats: 2,
        status: 'pending',
        fare: { total: 125, driverEarnings: 120 },
        offeredAt: 1_700_000_000_000,
      }),
    ]);
    expect(onOffers.mock.calls[0][0][0]).not.toHaveProperty('passengerId');
    expect(onError).not.toHaveBeenCalled();
    expect(unsubscribe).toBe(mocks.unsubscribe);
  });

  it('drops legacy or incomplete offers instead of inventing mode and seat values', () => {
    const onOffers = vi.fn();
    const onError = vi.fn();
    mocks.onSnapshot.mockImplementation((_query, onNext) => {
      onNext({
        docs: [{
          id: 'legacy-offer',
          data: () => ({
            tripId: 'trip-legacy',
            status: 'pending',
            mode: 'hopon',
            pickup: { latitude: 11.0, longitude: 124.6 },
            destination: { latitude: 11.1, longitude: 124.7 },
            fare: 125,
          }),
        }],
      });
      return mocks.unsubscribe;
    });

    subscribeDriverOffers('driver-1', onOffers, onError);

    expect(onOffers).toHaveBeenCalledWith([]);
    expect(onError).not.toHaveBeenCalled();
  });

  it('drops a Solo offer with a legacy scalar fare instead of inventing the offer shape', () => {
    const onOffers = vi.fn();
    mocks.onSnapshot.mockImplementation((_query, onNext) => {
      onNext({
        docs: [{
          id: 'scalar-offer',
          data: () => ({
            tripId: 'trip-scalar',
            status: 'pending',
            mode: 'solo',
            passengerCount: 1,
            billedSeats: 1,
            pickup: { latitude: 11.0, longitude: 124.6 },
            destination: { latitude: 11.1, longitude: 124.7 },
            fare: 125,
          }),
        }],
      });
      return mocks.unsubscribe;
    });

    subscribeDriverOffers('driver-1', onOffers, vi.fn());

    expect(onOffers).toHaveBeenCalledWith([]);
  });

  it('maps a server-created Hop offer without inventing mode or seat values', () => {
    const onOffers = vi.fn();
    mocks.onSnapshot.mockImplementation((_query, onNext) => {
      onNext({
        docs: [{
          id: 'hop-offer',
          data: () => ({
            tripId: 'hop-trip',
            driverId: 'driver-1',
            status: 'pending',
            mode: 'hop',
            passengerCount: 1,
            billedSeats: 1,
            pickup: { latitude: 11.0, longitude: 124.6, label: 'Hop pickup' },
            destination: { latitude: 11.1, longitude: 124.7, label: 'Hop destination' },
            fare: { total: 45, driverEarnings: 40 },
            sharedRideId: 'shared-1',
            offeredAt: { toMillis: () => 1_700_000_000_000 },
            expiresAt: { toMillis: () => Date.now() + 30_000 },
          }),
        }],
      });
      return mocks.unsubscribe;
    });

    subscribeDriverOffers('driver-1', onOffers, vi.fn());

    expect(onOffers.mock.calls[0][0][0]).toMatchObject({
      mode: 'hop',
      passengerCount: 1,
      billedSeats: 1,
      fare: { total: 45, driverEarnings: 40 },
      sharedRideId: 'shared-1',
    });
  });

  it('accepts a specific offer through the server callable', async () => {
    mocks.callable.mockResolvedValue({ data: { result: 'accepted' } });

    await expect(acceptTripOffer('trip-1', 'offer-1', 'driver-1')).resolves.toBe('accepted');
    expect(mocks.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'acceptTripOffer');
    expect(mocks.callable).toHaveBeenCalledWith({
      tripId: 'trip-1',
      offerId: 'offer-1',
      driverId: 'driver-1',
    });
  });

  it('declines a specific addressed offer through the server callable', async () => {
    mocks.callable.mockResolvedValue({ data: { result: 'declined' } });

    await expect(declineTripOffer('trip-1', 'offer-1', 'driver-1')).resolves.toBe('declined');
    expect(mocks.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'declineTripOffer');
    expect(mocks.callable).toHaveBeenCalledWith({
      tripId: 'trip-1',
      offerId: 'offer-1',
      driverId: 'driver-1',
    });
  });
});
