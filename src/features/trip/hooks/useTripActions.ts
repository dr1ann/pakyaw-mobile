import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cancel, transition } from '../services/trip.service';
import type { CancelledBy, TripStatus } from '../types';
import { useSessionStore } from '@/stores/sessionStore';

export function useTripTransition() {
  const queryClient = useQueryClient();
  const uid = useSessionStore((s) => s.uid);

  return useMutation({
    mutationFn: async ({ tripId, status }: { tripId: string; status: TripStatus }) => {
      await transition(tripId, status);
    },
    onSuccess: () => {
      if (uid) {
        queryClient.invalidateQueries({ queryKey: ['history', uid] });
      }
    },
  });
}

export function useCancelTrip() {
  const queryClient = useQueryClient();
  const uid = useSessionStore((s) => s.uid);

  return useMutation({
    mutationFn: async ({
      tripId,
      by,
      reason,
    }: {
      tripId: string;
      by: CancelledBy;
      reason: string;
    }) => {
      await cancel(tripId, by, reason);
    },
    onSuccess: () => {
      if (uid) {
        queryClient.invalidateQueries({ queryKey: ['history', uid] });
      }
    },
  });
}
