import { create } from 'zustand';

import type { TripDoc } from '@/features/trip/types';

export type ActiveTripState = {
  readonly tripId: string | null;
  readonly trip: TripDoc | null;
  readonly driverLocation: { latitude: number; longitude: number } | null;
  
  // Ephemeral navigation state (never persisted to Firestore)
  readonly navCameraMode: 'follow' | 'overview';
  readonly navHeading: number | null; // fused, smoothed heading
  readonly gpsHeading: number | null; // raw GPS heading
  readonly gpsSpeed: number | null;   // raw GPS speed
  readonly navStepIndex: number;      // current step index in the route

  setTripId: (tripId: string) => void;
  setTrip: (trip: TripDoc) => void;
  clearTrip: () => void;
  setDriverLocation: (location: { latitude: number; longitude: number }) => void;
  clearDriverLocation: () => void;

  // Navigation actions
  setNavCameraMode: (mode: 'follow' | 'overview') => void;
  setNavHeading: (heading: number | null) => void;
  setGpsLocation: (lat: number, lng: number, heading: number | null, speed: number | null) => void;
  setNavStepIndex: (index: number) => void;
  resetNav: () => void;
};

const initialNavState = {
  navCameraMode: 'overview' as const,
  navHeading: null,
  gpsHeading: null,
  gpsSpeed: null,
  navStepIndex: 0,
};

export const useActiveTripStore = create<ActiveTripState>((set) => ({
  tripId: null,
  trip: null,
  driverLocation: null,
  ...initialNavState,

  setTripId: (tripId) => set({ tripId }),
  setTrip: (trip) => set({ trip, tripId: trip.id }),
  clearTrip: () => set({ trip: null, tripId: null, driverLocation: null, ...initialNavState }),
  setDriverLocation: (location) => set({ driverLocation: location }),
  clearDriverLocation: () => set({ driverLocation: null }),

  setNavCameraMode: (navCameraMode) => set({ navCameraMode }),
  setNavHeading: (navHeading) => set({ navHeading }),
  setGpsLocation: (lat, lng, heading, speed) => set({
    gpsHeading: heading,
    gpsSpeed: speed,
    // Note: driverLocation is also updated locally here to match high-frequency stream
    driverLocation: { latitude: lat, longitude: lng },
  }),
  setNavStepIndex: (navStepIndex) => set({ navStepIndex }),
  resetNav: () => set(initialNavState),
}));

