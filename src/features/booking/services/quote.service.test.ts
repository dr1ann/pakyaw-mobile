import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callable: vi.fn(),
  httpsCallable: vi.fn(),
}));

vi.mock('firebase/functions', () => ({ httpsCallable: mocks.httpsCallable }));
vi.mock('@/services/firebase/firebase', () => ({ functions: {} }));
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
        billedSeats: 1,
        fare: { baseFare: 55, distanceFare: 0, surcharges: 0, techFee: 0, total: 55, driverEarnings: 55 },
      },
    });
  });

  it('sends intent only and returns the structured server quote', async () => {
    await expect(quoteTrip(input)).resolves.toMatchObject({ mode: 'solo', billedSeats: 1, fare: { total: 55 } });
    expect(mocks.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'quoteTrip');
    expect(mocks.callable).toHaveBeenCalledWith({
      mode: 'solo',
      pickup: { latitude: 11.005, longitude: 124.6075, label: 'Pickup' },
      destination: { latitude: 11.012, longitude: 124.615, label: 'Destination' },
      route: input.route,
      passengerCount: 1,
    });
    expect(mocks.callable.mock.calls[0][0]).not.toHaveProperty('driverId');
    expect(mocks.callable.mock.calls[0][0]).not.toHaveProperty('billedSeats');
    expect(mocks.callable.mock.calls[0][0]).not.toHaveProperty('fare');
  });
});
