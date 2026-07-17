import { useMutation } from '@tanstack/react-query';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import type { CreateBookingInput } from '../types';
import { createTrip } from '../services/booking.service';
import { joinSharedRide } from '@pakyaw/shared/features/trip/services/sharedRide.service';

export function useJoinSharedRide() {
  const setTripId = useActiveTripStore((s) => s.setTripId);

  return useMutation({
    mutationFn: async (input: CreateBookingInput & { sharedRideId: string }) => {
      const uid = useSessionStore.getState().uid;
      if (!uid) {
        throw new Error('Not signed in.');
      }
      
      // 1. Create the trip doc
      const tripId = await createTrip(input, uid);
      
      // 2. Join the shared ride
      await joinSharedRide(input.sharedRideId, tripId);
      
      return tripId;
    },
    onSuccess: (tripId) => {
      setTripId(tripId);
      useBookingDraftStore.getState().reset();
    },
  });
}
