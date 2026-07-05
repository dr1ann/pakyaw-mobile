import { useQuery } from '@tanstack/react-query';
import { getRoute, type RouteResult } from '@pakyaw/shared/features/maps/services/routingService';
import type { Place } from '@pakyaw/shared/types/place';

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

  const roundCoord = (num?: number) => (num != null ? Math.round(num * 100000) / 100000 : null);

  return useQuery<RouteResult, Error>({
    queryKey: [
      'route',
      roundCoord(pickupCoords?.lat),
      roundCoord(pickupCoords?.lng),
      roundCoord(destinationCoords?.lat),
      roundCoord(destinationCoords?.lng),
    ],
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
