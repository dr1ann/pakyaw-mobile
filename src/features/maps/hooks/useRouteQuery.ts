import { useQuery } from '@tanstack/react-query';
import { getRoute, type RouteResult } from '../services/routingService';
import type { Place } from '@/features/booking/types';

type UseRouteQueryProps = {
  readonly pickup: Place | null;
  readonly destination: Place | null;
};

/**
 * Hook to fetch route polyline, distance, and duration between pickup and destination (Phase 12).
 */
export function useRouteQuery({ pickup, destination }: UseRouteQueryProps) {
  const pickupCoords = pickup?.coords;
  const destinationCoords = destination?.coords;

  const enabled = !!pickupCoords && !!destinationCoords;

  return useQuery<RouteResult, Error>({
    queryKey: ['route', pickupCoords, destinationCoords],
    queryFn: async () => {
      if (!pickupCoords || !destinationCoords) {
        throw new Error('Coordinates missing.');
      }
      return getRoute(pickupCoords, destinationCoords);
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}
