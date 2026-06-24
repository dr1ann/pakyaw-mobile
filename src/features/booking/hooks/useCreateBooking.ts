import { useMutation } from '@tanstack/react-query';

import { createTrip } from '@/features/booking/services/booking.service';
import type { CreateBookingInput } from '@/features/booking/types';
import { useActiveTripStore } from '@/stores/activeTripStore';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { useSessionStore } from '@/stores/sessionStore';

export function useCreateBooking() {
  const setTripId = useActiveTripStore((s) => s.setTripId);
  const resetDraft = useBookingDraftStore((s) => s.reset);

  return useMutation({
    mutationFn: async (input: CreateBookingInput) => {
      const uid = useSessionStore.getState().uid;
      if (!uid) {
        throw new Error('Not signed in.');
      }
      return createTrip(input, uid);
    },
    onSuccess: (tripId) => {
      setTripId(tripId);
      resetDraft();
    },
  });
}
