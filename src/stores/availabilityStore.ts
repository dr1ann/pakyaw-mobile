/**
 * Zustand store for driver availability.
 *
 * Owns the client-side view of the driver's current availability status.
 * Firestore is the authoritative source; this store is a local mirror
 * that drives the UI.
 *
 * Availability values match the DriverDoc schema:
 *   'offline' | 'online' | 'on_trip'
 *
 * Phase 5: offline ↔ online transitions driven by useAvailability.
 * Phase 7: 'on_trip' set via the accept transaction; incomingRequests holds
 * the local mirror of trips streamed from subscribeIncoming. Decline removes
 * locally only — never writes to Firestore.
 *
 * NOTE: preflightPassed was intentionally moved out of this store.
 * It is purely a one-shot handshake between drive.tsx and useGoOnlineMutation;
 * no other component needs it. It lives as local state in drive.tsx.
 */

import { create } from 'zustand';

import type { Availability } from '@pakyaw/shared/types/driver';
import type { IncomingRequest } from '@/features/matching/types';

export type AvailabilityState = {
  /** Current availability status. Starts offline until explicitly toggled. */
  readonly availability: Availability;
  /**
   * Last known location coords — kept in store so the placeholder map (and
   * eventually the real map) can read them without a separate hook query.
   */
  readonly lastLatitude: number | null;
  readonly lastLongitude: number | null;
  /**
   * Local mirror of trip requests streamed from subscribeIncoming, plus any
   * locally-declined cards. Replaced wholesale on each snapshot via
   * setIncomingRequests; individual removals (decline / TripAlreadyTakenError)
   * use removeIncomingRequest. Never written back to Firestore.
   */
  readonly incomingRequests: readonly IncomingRequest[];

  // --- Actions ---
  setAvailability: (availability: Availability) => void;
  setLastLocation: (lat: number, lng: number) => void;
  setIncomingRequests: (requests: readonly IncomingRequest[]) => void;
  removeIncomingRequest: (tripId: string) => void;
  clearIncomingRequests: () => void;
  reset: () => void;
};

const initialState = {
  availability: 'offline' as Availability,
  lastLatitude: null,
  lastLongitude: null,
  incomingRequests: [] as readonly IncomingRequest[],
};

export const useAvailabilityStore = create<AvailabilityState>((set) => ({
  ...initialState,

  setAvailability: (availability) => set({ availability }),

  setLastLocation: (lat, lng) =>
    set({ lastLatitude: lat, lastLongitude: lng }),

  setIncomingRequests: (requests) => set({ incomingRequests: requests }),

  removeIncomingRequest: (tripId) =>
    set((state) => ({
      incomingRequests: state.incomingRequests.filter((r) => r.tripId !== tripId),
    })),

  clearIncomingRequests: () => set({ incomingRequests: [] }),

  reset: () => set(initialState),
}));
