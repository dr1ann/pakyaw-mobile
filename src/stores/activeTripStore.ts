import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { TripDoc, TripStatus } from '@/features/trip/types';

export const ACTIVE_TRIP_NAV_STORAGE_KEY = 'pakyaw:active-trip-navigation';

export type NavigationSession = {
  readonly startedAt: number;
  readonly lastForegroundAt: number;
  readonly lastBackgroundedAt: number | null;
};

export type ActiveTripState = {
  readonly tripId: string | null;
  readonly trip: TripDoc | null;
  readonly driverLocation: { latitude: number; longitude: number } | null;
  
  // Ephemeral navigation state (never persisted to Firestore)
  readonly navHeading: number | null; // fused, smoothed heading
  readonly gpsHeading: number | null; // raw GPS heading
  readonly gpsSpeed: number | null;   // raw GPS speed
  readonly navStepIndex: number;      // current step index in the route

  // Driving-camera gate. Navigation Mode (tilted follow camera) is armed only
  // while trip.status === navActiveStatus. The driver screen derives this from
  // trip status so active driving legs auto-start and non-driving phases disarm.
  // Persisted across app restarts so that re-launching mid-drive doesn't fall
  // back to overview before the trip subscription rehydrates.
  // null = overview camera (no driving mode).
  readonly navActiveStatus: TripStatus | null;
  readonly navSession: NavigationSession | null;
  readonly cameraFollowing: boolean;

  setTripId: (tripId: string) => void;
  setTrip: (trip: TripDoc) => void;
  clearTrip: () => void;
  setDriverLocation: (location: { latitude: number; longitude: number }) => void;
  clearDriverLocation: () => void;

  // Navigation actions
  setNavHeading: (heading: number | null) => void;
  setGpsLocation: (lat: number, lng: number, heading: number | null, speed: number | null) => void;
  setNavStepIndex: (index: number) => void;
  setNavActiveStatus: (status: TripStatus | null) => void;
  setNavSession: (session: NavigationSession | null) => void;
  updateNavSession: (updates: Partial<NavigationSession>) => void;
  setCameraFollowing: (cameraFollowing: boolean) => void;
  resetNav: () => void;
};

export type PersistedActiveTripState = Pick<
  ActiveTripState,
  'tripId' | 'navStepIndex' | 'navActiveStatus' | 'navSession' | 'cameraFollowing'
>;

const initialNavState = {
  navHeading: null,
  gpsHeading: null,
  gpsSpeed: null,
  navStepIndex: 0,
  navActiveStatus: null,
  navSession: null,
  cameraFollowing: true,
};

function isTerminalTripStatus(status: TripStatus | null | undefined): boolean {
  return status === 'completed' || status === 'cancelled';
}

export function getPersistedActiveTripState(
  state: ActiveTripState,
): PersistedActiveTripState {
  return {
    tripId: state.tripId,
    navStepIndex: state.navStepIndex,
    navActiveStatus: state.navActiveStatus,
    navSession: state.navSession,
    cameraFollowing: state.cameraFollowing,
  };
}

export function migratePersistedActiveTripState(
  persistedState: unknown,
  fromVersion: number,
): PersistedActiveTripState {
  if (fromVersion < 2) {
    const prev = (persistedState ?? {}) as Partial<PersistedActiveTripState>;
    return {
      tripId: prev.tripId ?? null,
      navStepIndex: prev.navStepIndex ?? 0,
      navActiveStatus: null,
      navSession: null,
      cameraFollowing: true,
    };
  }

  if (fromVersion < 3) {
    const prev = (persistedState ?? {}) as Partial<PersistedActiveTripState>;
    return {
      tripId: prev.tripId ?? null,
      navStepIndex: prev.navStepIndex ?? 0,
      navActiveStatus: prev.navActiveStatus ?? null,
      navSession: null,
      cameraFollowing: true,
    };
  }

  return persistedState as PersistedActiveTripState;
}

export const useActiveTripStore = create<ActiveTripState>()(
  persist(
    (set) => ({
      tripId: null,
      trip: null,
      driverLocation: null,
      ...initialNavState,

      setTripId: (tripId) => set({ tripId }),
      setTrip: (trip) =>
        set({
          trip,
          tripId: trip.id,
          // A terminal status (completed/cancelled) is the canonical end of
          // the navigation session — wipe every nav-only slice eagerly so the
          // map, banner, voice, and camera all see a clean state the moment
          // the trip transitions, not only when the driver taps Done.
          ...(isTerminalTripStatus(trip.status)
            ? {
                navHeading: null,
                gpsHeading: null,
                gpsSpeed: null,
                navStepIndex: 0,
                navActiveStatus: null,
                navSession: null,
                cameraFollowing: true,
              }
            : {}),
        }),
      clearTrip: () => set({ trip: null, tripId: null, driverLocation: null, ...initialNavState }),
      setDriverLocation: (location) => set({ driverLocation: location }),
      clearDriverLocation: () => set({ driverLocation: null }),

      setNavHeading: (navHeading) => set({ navHeading }),
      setGpsLocation: (lat, lng, heading, speed) => set({
        gpsHeading: heading,
        gpsSpeed: speed,
        // Note: driverLocation is also updated locally here to match high-frequency stream
        driverLocation: { latitude: lat, longitude: lng },
      }),
      setNavStepIndex: (navStepIndex) => set({ navStepIndex }),
      setNavActiveStatus: (navActiveStatus) => set({ navActiveStatus }),
      setNavSession: (navSession) => set({ navSession }),
      updateNavSession: (updates) =>
        set((state) => {
          if (!state.navSession) {
            return {};
          }
          return { navSession: { ...state.navSession, ...updates } };
        }),
      setCameraFollowing: (cameraFollowing) => set({ cameraFollowing }),
      resetNav: () => set(initialNavState),
    }),
    {
      name: ACTIVE_TRIP_NAV_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: getPersistedActiveTripState,
      version: 3,
      migrate: migratePersistedActiveTripState,
        // v1 → v2: navActiveStatus added to the persisted slice. Older stored
        // payloads have no value for it, so default to null (overview camera).
    },
  ),
);
