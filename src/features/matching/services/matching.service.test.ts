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

import { acceptTripOffer, subscribeDriverOffers } from '@/features/matching/services/matching.service';

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
              pickup: { latitude: 11.0, longitude: 124.6, label: 'Pickup' },
              destination: { latitude: 11.1, longitude: 124.7, label: 'Destination' },
              fare: 125,
              offeredAt: { toMillis: () => 1_700_000_000_000 },
              expiresAt: { toMillis: () => Date.now() + 30_000 },
            }),
          },
          {
            id: 'offer-expired',
            data: () => ({
              tripId: 'trip-2',
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
        fare: 125,
        offeredAt: 1_700_000_000_000,
      }),
    ]);
    expect(onError).not.toHaveBeenCalled();
    expect(unsubscribe).toBe(mocks.unsubscribe);
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
});
