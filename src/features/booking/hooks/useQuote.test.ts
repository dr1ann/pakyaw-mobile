import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  quoteTrip: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('@/features/booking/services/quote.service', () => ({
  quoteTrip: mocks.quoteTrip,
}));

let mockDraft = {
  rideMode: 'private' as const,
  pickup: { label: 'Home', coords: { lat: 11.005, lng: 124.6075 } } as any,
  destination: { label: 'Market', coords: { lat: 11.015, lng: 124.615 } } as any,
  passengerCount: 1,
  route: {
    distanceMeters: 1500,
    durationSeconds: 300,
    polyline: 'poly123',
    source: {
      pickup: { lat: 11.005, lng: 124.6075 },
      destination: { lat: 11.015, lng: 124.615 },
    },
  } as any,
};

vi.mock('@/stores/bookingDraftStore', () => ({
  useBookingDraftStore: (selector: any) => selector({ draft: mockDraft }),
  routeMatchesInputs: (draft: any) => !!draft.route,
}));

import { useQuote } from './useQuote';

describe('useQuote hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDraft = {
      rideMode: 'private',
      pickup: { label: 'Home', coords: { lat: 11.005, lng: 124.6075 } },
      destination: { label: 'Market', coords: { lat: 11.015, lng: 124.615 } },
      passengerCount: 1,
      route: {
        distanceMeters: 1500,
        durationSeconds: 300,
        polyline: 'poly123',
        source: {
          pickup: { lat: 11.005, lng: 124.6075 },
          destination: { lat: 11.015, lng: 124.615 },
        },
      },
    };
    mocks.useQuery.mockReturnValue({
      data: {
        mode: 'solo',
        passengerCount: 1,
        billedSeats: 6,
        fare: { total: 345, baseFare: 330, techFee: 15 },
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('enables query with correct key and payload when route is valid', async () => {
    const result = useQuote();
    expect(result.canQuote).toBe(true);
    expect(result.quote).toMatchObject({ billedSeats: 6, fare: { total: 345 } });

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['quoteTrip', 'private', 11.005, 124.6075, 11.015, 124.615, 1, 1500, 'poly123'],
        enabled: true,
      }),
    );

    const queryOptions = mocks.useQuery.mock.calls[0][0];
    await queryOptions.queryFn();
    expect(mocks.quoteTrip).toHaveBeenCalledWith({
      mode: 'solo',
      pickup: mockDraft.pickup,
      destination: mockDraft.destination,
      passengerCount: 1,
      route: {
        distanceMeters: 1500,
        durationSeconds: 300,
        polyline: 'poly123',
      },
    });
  });

  it('disables query when route is missing', () => {
    mockDraft.route = null;
    useQuote();
    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it('disables query when distance is under 50 meters', () => {
    mockDraft.route = { ...mockDraft.route, distanceMeters: 30 };
    useQuote();
    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });
});
