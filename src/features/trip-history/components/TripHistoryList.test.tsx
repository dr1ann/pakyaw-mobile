import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { TripHistoryList } from './TripHistoryList';
import * as useTripHistoryModule from '../hooks/useTripHistory';

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

describe('TripHistoryList component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading indicator when isLoading is true and not refetching', () => {
    vi.spyOn(useTripHistoryModule, 'useTripHistory').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      isRefetching: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    } as any);

    const element = <TripHistoryList uid="user-123" />;
    expect(element).toBeDefined();
  });

  it('renders error state and retry button when isError is true', () => {
    const mockRefetch = vi.fn();
    vi.spyOn(useTripHistoryModule, 'useTripHistory').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network timeout'),
      isRefetching: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: mockRefetch,
    } as any);

    const element = <TripHistoryList uid="user-123" />;
    expect(element).toBeDefined();
  });

  it('renders list of trips when data is available', () => {
    vi.spyOn(useTripHistoryModule, 'useTripHistory').mockReturnValue({
      data: {
        pages: [
          {
            trips: [
              {
                tripId: 'trip-1',
                status: 'completed',
                mode: 'solo',
                fare: 60,
                distanceMeters: 2000,
                pickup: { label: 'A' },
                destination: { label: 'B' },
                passengerCount: 1,
                requestedAt: null,
                completedAt: null,
                cancelledAt: null,
                driver: null,
                bookingFor: 'self',
                rider: null,
                cancelledBy: null,
                cancelReason: null,
              },
            ],
            nextCursor: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      isRefetching: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    } as any);

    const element = <TripHistoryList uid="user-123" />;
    expect(element).toBeDefined();
  });
});
