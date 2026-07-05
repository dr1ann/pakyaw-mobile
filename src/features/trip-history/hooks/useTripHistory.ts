import { useInfiniteQuery } from '@tanstack/react-query';

import { listForPassenger } from '@pakyaw/shared/features/trip-history/services/history.service';
import type { HistoryCursor } from '@pakyaw/shared/features/trip-history/types';

export function useTripHistory(uid: string | null) {
  return useInfiniteQuery({
    queryKey: ['history', uid],
    queryFn: ({ pageParam }) =>
      listForPassenger(uid!, { limit: 10, cursor: pageParam }),
    initialPageParam: null as HistoryCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!uid,
    staleTime: 60_000, // 1 min
  });
}
