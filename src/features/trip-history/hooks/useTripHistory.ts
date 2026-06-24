import { useInfiniteQuery } from '@tanstack/react-query';

import { listForPassenger } from '../services/history.service';
import type { HistoryCursor } from '../types';

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
