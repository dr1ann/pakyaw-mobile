import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDriverTripHistory, useDriverAllCompletedTrips } from './useDriverTripHistory';

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: vi.fn((options) => options),
  useQuery: vi.fn((options) => options),
}));

vi.mock('../services/history.service', () => ({
  listForDriver: vi.fn(),
}));

describe('useDriverTripHistory and useDriverAllCompletedTrips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useDriverTripHistory creates infinite query with correct queryKey and enabled flag', () => {
    const opts = useDriverTripHistory('driver-123') as any;
    expect(opts.queryKey).toEqual(['driverTripHistory', 'driver-123']);
    expect(opts.enabled).toBe(true);
    expect(opts.initialPageParam).toBeNull();
  });

  it('useDriverTripHistory is disabled when driverUid is undefined', () => {
    const opts = useDriverTripHistory(undefined) as any;
    expect(opts.enabled).toBe(false);
  });

  it('useDriverAllCompletedTrips creates query with correct queryKey and enabled flag', () => {
    const opts = useDriverAllCompletedTrips('driver-123') as any;
    expect(opts.queryKey).toEqual(['driverAllCompletedTrips', 'driver-123']);
    expect(opts.enabled).toBe(true);
  });

  it('useDriverAllCompletedTrips is disabled when driverUid is undefined', () => {
    const opts = useDriverAllCompletedTrips(undefined) as any;
    expect(opts.enabled).toBe(false);
  });
});
