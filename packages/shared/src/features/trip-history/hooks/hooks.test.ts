import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTripDetail } from './useTripDetail';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((options) => options),
}));

vi.mock('../services/history.service', () => ({
  getTrip: vi.fn(),
}));

describe('trip-history hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
