import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cancel, transition } from '../services/trip.service';
import type { CancelReason, CancelledBy, TripStatus } from '../types';
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
      by,
      reason,
    }: {
      tripId: string;
      by: CancelledBy;
      reason: CancelReason | string;
    }) => {
      const uid = useSessionStore.getState().uid;
      if (!uid) throw new Error('Not signed in.');
      const canonicalReason: CancelReason = [
        'passenger_changed_mind',
        'driver_unavailable',
        'unable_to_locate_passenger',
        'vehicle_issue',
        'safety_concern',
        'other',
      ].includes(reason)
        ? reason as CancelReason
        : by === 'passenger' ? 'passenger_changed_mind' : 'other';
      await cancel(tripId, uid, canonicalReason);
    },
    onSuccess: () => {
      const uid = useSessionStore.getState().uid;
      if (uid) {
        queryClient.invalidateQueries({ queryKey: ['history', uid] });
      }
    },
  });
}
