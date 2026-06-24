import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTripDetail } from './useTripDetail';
import { useTripHistory } from './useTripHistory';

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: vi.fn((options) => options),
  useQuery: vi.fn((options) => options),
}));

vi.mock('../services/history.service', () => ({
  listForPassenger: vi.fn(),
  getTrip: vi.fn(),
}));

describe('trip-history hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useTripHistory has correct key, staleTime (1 min), and is enabled when uid is provided', () => {
    const opts = useTripHistory('passenger-uid') as any;
    expect(opts.queryKey).toEqual(['history', 'passenger-uid']);
    expect(opts.staleTime).toBe(60000);
    expect(opts.initialPageParam).toBeNull();
    expect(opts.enabled).toBe(true);
  });

  it('useTripHistory is disabled when uid is null', () => {
    const opts = useTripHistory(null) as any;
    expect(opts.enabled).toBe(false);
  });

  it('useTripDetail has correct key, staleTime (Infinity), and is enabled when tripId is provided', () => {
    const opts = useTripDetail('trip-uid') as any;
    expect(opts.queryKey).toEqual(['trip', 'trip-uid']);
    expect(opts.staleTime).toBe(Infinity);
    expect(opts.enabled).toBe(true);
  });

  it('useTripDetail is disabled when tripId is undefined', () => {
    const opts = useTripDetail(undefined) as any;
    expect(opts.enabled).toBe(false);
  });
});
