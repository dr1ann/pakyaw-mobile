import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callable: vi.fn(),
  httpsCallable: vi.fn(),
}));

vi.mock('@/services/firebase/firebase', () => ({
  functions: {},
  httpsCallable: mocks.httpsCallable,
}));
vi.mock('@pakyaw/shared/lib/logger', () => ({ logger: { error: vi.fn() } }));

import { quoteTrip } from './quote.service';

describe('quote.service — server-authoritative quote boundary', () => {
  const input = {
    mode: 'solo' as const,
    pickup: { label: 'Pickup', coords: { lat: 11.005, lng: 124.6075 } },
    destination: { label: 'Destination', coords: { lat: 11.012, lng: 124.615 } },
    passengerCount: 1,
    route: { distanceMeters: 1_200, durationSeconds: 300, polyline: 'encoded-route' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.httpsCallable.mockReturnValue(mocks.callable);
    mocks.callable.mockResolvedValue({
      data: {
        mode: 'solo',
        passengerCount: 1,
        billedSeats: 4,
        fare: {
          baseFare: 220,
          succeedingKmCharge: 0,
          distanceFare: 0,
          surcharges: 0,
          techFee: 15,
          total: 235,
          driverEarnings: 220,
        },
      },
    });
  });

  it('sends intent only and returns the structured server quote', async () => {
    const quote = await quoteTrip(input);
    expect(quote).toMatchObject({
      mode: 'solo',
      passengerCount: 1,
      billedSeats: 4,
      fare: { total: 235, baseFare: 220, techFee: 15 },
    });
    expect(mocks.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'quoteTrip');
    expect(mocks.callable).toHaveBeenCalledWith({
      mode: 'solo',
      pickup: { latitude: 11.005, longitude: 124.6075, label: 'Pickup' },
      destination: { latitude: 11.012, longitude: 124.615, label: 'Destination' },
      route: input.route,
      passengerCount: 1,
    });
    // Verifies passenger client cannot send or forge authoritative fields
    const sentPayload = mocks.callable.mock.calls[0][0];
    expect(sentPayload).not.toHaveProperty('driverId');
    expect(sentPayload).not.toHaveProperty('billedSeats');
    expect(sentPayload).not.toHaveProperty('fare');
    expect(sentPayload).not.toHaveProperty('serviceFee');
    expect(sentPayload).not.toHaveProperty('driverEarnings');
    expect(sentPayload).not.toHaveProperty('surcharges');
  });

  it('returns 4-seat buyout for Solo even when 1 passenger is boarding', async () => {
    const quote = await quoteTrip({ ...input, passengerCount: 1 });
    expect(quote.passengerCount).toBe(1);
    expect(quote.billedSeats).toBe(4);
    expect(quote.fare.total).toBe(235);
  });

  it('accepts a canonical Shared quote with reserved seats', async () => {
    mocks.callable.mockResolvedValueOnce({
      data: {
        mode: 'shared',
        passengerCount: 2,
        billedSeats: 2,
        fare: {
          baseFare: 110,
          succeedingKmCharge: 0,
          distanceFare: 0,
          surcharges: 0,
          techFee: 15,
          total: 125,
          driverEarnings: 110,
        },
      },
    });

    const quote = await quoteTrip({ ...input, mode: 'shared', passengerCount: 2 });
    expect(quote).toMatchObject({
      mode: 'shared',
      passengerCount: 2,
      billedSeats: 2,
      fare: { total: 125 },
    });
    expect(mocks.callable).toHaveBeenCalledWith(expect.objectContaining({ mode: 'shared', passengerCount: 2 }));
  });

  it('accepts a canonical Hop quote without sending a SharedRide target', async () => {
    mocks.callable.mockResolvedValueOnce({
      data: {
        mode: 'hop',
        passengerCount: 1,
        billedSeats: 1,
        fare: {
          baseFare: 55,
          succeedingKmCharge: 0,
          distanceFare: 0,
          surcharges: 0,
          techFee: 15,
          total: 70,
          driverEarnings: 55,
        },
      },
    });

    await expect(quoteTrip({ ...input, mode: 'hop' })).resolves.toMatchObject({ mode: 'hop', billedSeats: 1 });
    expect(mocks.callable).toHaveBeenCalledWith(expect.objectContaining({ mode: 'hop', passengerCount: 1 }));
    expect(mocks.callable.mock.calls[0][0]).not.toHaveProperty('sharedRideId');
  });
});
