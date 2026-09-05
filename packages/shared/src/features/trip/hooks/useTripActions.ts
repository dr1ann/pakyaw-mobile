import { isCancellationReason } from '../cancellationReasons';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cancel, transition } from '../services/trip.service';
import type { CancelledBy, TripStatus } from '../types';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

export function useTripTransition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tripId, status }: { tripId: string; status: TripStatus }) => {
      const uid = useSessionStore.getState().uid;
      if (!uid) throw new Error('Not signed in.');
      await transition(tripId, uid, status);
    },
    onSuccess: () => {
      const uid = useSessionStore.getState().uid;
      if (uid) {
        queryClient.invalidateQueries({ queryKey: ['history', uid] });
      }
    },
  });
}

export function useCancelTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tripId,
      reason,
    }: {
      tripId: string;
      by: CancelledBy;
      reason: string;
    }) => {
      const uid = useSessionStore.getState().uid;
      if (!uid) throw new Error('Not signed in.');
      if (!isCancellationReason(reason)) {
        throw new Error('Please select a cancellation reason.');
      }
      await cancel(tripId, uid, reason);
    },
    onSuccess: () => {
      const uid = useSessionStore.getState().uid;
      if (uid) {
        queryClient.invalidateQueries({ queryKey: ['history', uid] });
      }
    },
  });
}
