import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { listForDriver } from '../services/history.service';
import type { HistoryCursor, TripHistoryItem } from '../types';

export const DRIVER_HISTORY_PAGE_SIZE = 20;

export function useDriverTripHistory(driverId: string | null | undefined) {
  return useInfiniteQuery<{ trips: TripHistoryItem[]; nextCursor: HistoryCursor | null }>({
    queryKey: ['driverTripHistory', driverId],
    queryFn: ({ pageParam }) =>
      listForDriver(driverId!, {
        limit: DRIVER_HISTORY_PAGE_SIZE,
        cursor: (pageParam as HistoryCursor | null) ?? null,
      }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(driverId),
    staleTime: 60_000,
  });
}

export function useDriverAllCompletedTrips(driverId: string | null | undefined) {
  return useQuery<{ trips: TripHistoryItem[] }>({
    queryKey: ['driverAllCompletedTrips', driverId],
    queryFn: async () => {
      const page = await listForDriver(driverId!, {
        limit: 100,
        cursor: null,
      });
      return { trips: page.trips };
    },
    enabled: Boolean(driverId),
    staleTime: 60_000,
  });
}
