/**
 * useAcceptTrip — Phase 7 mutation hook.
 *
 * Wraps matching.service.acceptTrip with TanStack Query. On
 * TripAlreadyTakenError the card is silently removed from the local
 * mirror — NO toast, NO alert, NO error UI. Any other error propagates
 * to the caller's onError handler for surfacing.
 *
 * State transition policy (pessimistic, Grab / Uber parity):
 *   The mutation only sets the local tripId so useActiveTrip can subscribe
 *   to trips/{tripId}. Availability transitions ('online' → 'on_trip') are
 *   driven by the incoming Firestore snapshot, NOT predicted here — the
 *   accept transaction has already written driver.availability = 'on_trip'
 *   atomically, and any local prediction would race the snapshot listener
 *   under a slow network and produce a temporary inconsistent UI.
 */

import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { TripAlreadyTakenError } from '@/features/matching/errors';
import { acceptTrip } from '@/features/matching/services/matching.service';
import type { AcceptTripInput } from '@/features/matching/types';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { useAvailabilityStore } from '@/stores/availabilityStore';

export function useAcceptTrip(): UseMutationResult<
  void,
  Error,
  AcceptTripInput
> {
  return useMutation<void, Error, AcceptTripInput>({
    mutationFn: ({ tripId, driverUid }) => acceptTrip(tripId, driverUid),
    onSuccess: (_data, variables) => {
      // Set tripId so useActiveTrip subscribes to trips/{tripId} and the
      // authoritative snapshot begins driving the UI. Do NOT predict
      // availability here — the snapshot will land and other subscribers
      // (e.g. useActiveTrip → activeTripStore.trip) will surface the trip.
      useActiveTripStore.getState().setTripId(variables.tripId);
    },
    onError: (err, variables) => {
      if (err instanceof TripAlreadyTakenError) {
        useAvailabilityStore.getState().removeIncomingRequest(variables.tripId);
      }
    },
  });
}
