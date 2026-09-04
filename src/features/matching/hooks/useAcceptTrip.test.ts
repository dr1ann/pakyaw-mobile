import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  acceptTripOffer: vi.fn(),
  removeIncomingRequest: vi.fn(),
  setTripId: vi.fn(),
}));

vi.mock('@/features/matching/services/matching.service', () => ({
  acceptTripOffer: mocks.acceptTripOffer,
}));

vi.mock('@pakyaw/shared/stores/activeTripStore', () => ({
  useActiveTripStore: {
    getState: () => ({
      setTripId: mocks.setTripId,
    }),
  },
}));

vi.mock('@/stores/availabilityStore', () => ({
  useAvailabilityStore: {
    getState: () => ({
      removeIncomingRequest: mocks.removeIncomingRequest,
    }),
  },
}));

let capturedMutationOptions: any = null;
vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: any) => {
    capturedMutationOptions = options;
    return {
      mutate: (variables: any, callOptions?: any) => {
        return options.mutationFn(variables).then(
          (result: any) => {
            options.onSuccess?.(result, variables);
            callOptions?.onSuccess?.(result, variables);
            return result;
          },
          (error: any) => {
            options.onError?.(error, variables);
            callOptions?.onError?.(error, variables);
            throw error;
          }
        );
      },
      isPending: false,
    };
  },
}));

import { useAcceptTrip } from '@/features/matching/hooks/useAcceptTrip';

describe('useAcceptTrip — Action Semantics & Race Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedMutationOptions = null;
  });

  it('sets active trip on accepted result', async () => {
    mocks.acceptTripOffer.mockResolvedValue('accepted');
    const hook = useAcceptTrip();

    await hook.mutate({
      tripId: 'trip-1',
      offerId: 'offer-1',
      driverUid: 'driver-1',
    });

    expect(mocks.setTripId).toHaveBeenCalledWith('trip-1');
    expect(mocks.removeIncomingRequest).not.toHaveBeenCalled();
  });

  it('removes incoming request when result is already_taken', async () => {
    mocks.acceptTripOffer.mockResolvedValue('already_taken');
    const hook = useAcceptTrip();

    await hook.mutate({
      tripId: 'trip-1',
      offerId: 'offer-1',
      driverUid: 'driver-1',
    });

    expect(mocks.removeIncomingRequest).toHaveBeenCalledWith('trip-1');
    expect(mocks.setTripId).not.toHaveBeenCalled();
  });

  it('regression: network error does not remove incoming request from store', async () => {
    mocks.acceptTripOffer.mockRejectedValue(new Error('Network unavailable'));
    const hook = useAcceptTrip();

    await expect(
      hook.mutate({
        tripId: 'trip-1',
        offerId: 'offer-1',
        driverUid: 'driver-1',
      })
    ).rejects.toThrow('Network unavailable');

    // Must NOT discard the offer on network failure
    expect(mocks.removeIncomingRequest).not.toHaveBeenCalled();
    expect(mocks.setTripId).not.toHaveBeenCalled();
  });
});
