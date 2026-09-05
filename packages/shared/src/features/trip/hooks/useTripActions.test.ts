import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCancelTrip, useTripTransition } from './useTripActions';
import * as tripService from '../services/trip.service';

const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn((options) => {
    return {
      mutate: async (variables: any) => {
        try {
          const res = await options.mutationFn(variables);
          if (options.onSuccess) {
            options.onSuccess(res, variables);
          }
          return res;
        } catch (err) {
          if (options.onError) {
            options.onError(err, variables);
          }
          throw err;
        }
      },
    };
  }),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
  })),
}));

vi.mock('../services/trip.service', () => ({
  transition: vi.fn().mockResolvedValue(undefined),
  cancel: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@pakyaw/shared/stores/sessionStore', () => {
  const store = { uid: 'passenger-123' };
  const mockUseSessionStore = (fn: any) => fn(store);
  (mockUseSessionStore as any).getState = () => store;
  return {
    useSessionStore: mockUseSessionStore,
  };
});

describe('useTripActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useTripTransition invalidates history on success', async () => {
    const hook = useTripTransition();
    await hook.mutate({ tripId: 'trip-1', status: 'completed' });

    expect(tripService.transition).toHaveBeenCalledWith('trip-1', 'passenger-123', 'completed');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['history', 'passenger-123'],
    });
  });

  it('useCancelTrip invalidates history on success', async () => {
    const hook = useCancelTrip();
    await hook.mutate({ tripId: 'trip-1', by: 'passenger', reason: 'passenger_changed_mind' });

    expect(tripService.cancel).toHaveBeenCalledWith('trip-1', 'passenger-123', 'passenger_changed_mind');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['history', 'passenger-123'],
    });
  });
  it.each(['passenger', 'driver'] as const)('submits the selected reason for %s', async (by) => {
    await useCancelTrip().mutate({ tripId: 'trip-1', by, reason: 'safety_concern' });
    expect(tripService.cancel).toHaveBeenCalledWith('trip-1', 'passenger-123', 'safety_concern');
  });

  it.each(['', '   ', 'I need to go', 'x'.repeat(501)])('blocks invalid cancellation text', async (reason) => {
    await expect(useCancelTrip().mutate({ tripId: 'trip-1', by: 'passenger', reason })).rejects.toThrow();
    expect(tripService.cancel).not.toHaveBeenCalled();
  });

  it('submits Other as the supported other code', async () => {
    await useCancelTrip().mutate({ tripId: 'trip-1', by: 'passenger', reason: 'other' });
    expect(tripService.cancel).toHaveBeenCalledWith('trip-1', 'passenger-123', 'other');
  });

});
