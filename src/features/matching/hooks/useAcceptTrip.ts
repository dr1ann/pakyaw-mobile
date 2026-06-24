/**
 * useAcceptTrip — Phase 7 mutation hook.
 *
 * Wraps matching.service.acceptTrip with TanStack Query. On
 * TripAlreadyTakenError the card is silently removed from the local
 * mirror — NO toast, NO alert, NO error UI. Any other error propagates
 * to the caller's onError handler for surfacing.
 */

import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { TripAlreadyTakenError } from '@/features/matching/errors';
import { acceptTrip } from '@/features/matching/services/matching.service';
import type { AcceptTripInput } from '@/features/matching/types';
import { useActiveTripStore } from '@/stores/activeTripStore';
import { useAvailabilityStore } from '@/stores/availabilityStore';

export function useAcceptTrip(): UseMutationResult<
  void,
  Error,
  AcceptTripInput
> {
  return useMutation<void, Error, AcceptTripInput>({
    mutationFn: ({ tripId, driverUid }) => acceptTrip(tripId, driverUid),
    onSuccess: (_data, variables) => {
      useAvailabilityStore.getState().setAvailability('on_trip');
      useActiveTripStore.getState().setTripId(variables.tripId);
    },
    onError: (err, variables) => {
      if (err instanceof TripAlreadyTakenError) {
        useAvailabilityStore.getState().removeIncomingRequest(variables.tripId);
      }
    },
  });
}
