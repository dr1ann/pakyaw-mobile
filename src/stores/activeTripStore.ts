import { create } from 'zustand';

import type { TripDoc } from '@/features/trip/types';

export type ActiveTripState = {
  readonly tripId: string | null;
  readonly trip: TripDoc | null;
  readonly driverLocation: { latitude: number; longitude: number } | null;
  setTripId: (tripId: string) => void;
  setTrip: (trip: TripDoc) => void;
  clearTrip: () => void;
  setDriverLocation: (location: { latitude: number; longitude: number }) => void;
  clearDriverLocation: () => void;
};

export const useActiveTripStore = create<ActiveTripState>((set) => ({
  tripId: null,
  trip: null,
  driverLocation: null,
  setTripId: (tripId) => set({ tripId }),
  setTrip: (trip) => set({ trip, tripId: trip.id }),
  clearTrip: () => set({ trip: null, tripId: null, driverLocation: null }),
  setDriverLocation: (location) => set({ driverLocation: location }),
  clearDriverLocation: () => set({ driverLocation: null }),
}));
