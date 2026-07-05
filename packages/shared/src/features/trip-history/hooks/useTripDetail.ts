import { useQuery } from '@tanstack/react-query';

import { getTrip } from '../services/history.service';

export function useTripDetail(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => getTrip(tripId!),
    enabled: !!tripId,
    staleTime: Infinity, // Terminal trips never change
  });
}
