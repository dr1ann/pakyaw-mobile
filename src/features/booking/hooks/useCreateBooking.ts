import { useMutation } from '@tanstack/react-query';

import { createTrip } from '@/features/booking/services/booking.service';
import type { CreateBookingInput } from '@/features/booking/types';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

export function useCreateBooking() {
  const setTripId = useActiveTripStore((s) => s.setTripId);

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
      useBookingDraftStore.getState().reset();
    },
  });
}
