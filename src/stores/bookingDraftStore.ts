import { create } from 'zustand';

import { clamp, MIN_SEATS } from '@/lib/seatModel';
import type { Place } from '@pakyaw/shared/types/place';
import type { LatLng } from '@pakyaw/shared/lib/geo';

/**
 * The accepted booking route, owned by the Booking Draft Store (§6.2, §13.2).
 * `source` records the pickup/destination the route was computed for so the
 * render selector can tell whether a retained route still matches the current
 * inputs (§13.2) — a route whose origin no longer matches is stale and must not
 * be drawn as if current. `source` is optional so direct setRoute() callers
 * (and older callers) keep working.
 */
export type AcceptedRoute = {
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly polyline: string;
  readonly pickupSnapDistanceMeters?: number;
  readonly dropoffSnapDistanceMeters?: number;
  readonly source?: {
    readonly pickup: LatLng;
    readonly destination: LatLng;
  };
};

export type BookingDraft = {
  readonly rideMode: 'private' | 'shared' | 'hopon';
  readonly pickup: Place | null;
  readonly destination: Place | null;
  readonly passengerCount: number;
  readonly route: AcceptedRoute | null;
};

export type BookingDraftState = {
  readonly draft: BookingDraft;
  setRideMode: (mode: 'private' | 'shared' | 'hopon') => void;
  setPickup: (pickup: Place | null) => void;
  setDestination: (destination: Place | null) => void;
  setPassengerCount: (count: number) => void;
  setRoute: (route: AcceptedRoute | null) => void;
  reset: () => void;
};

const emptyDraft: BookingDraft = {
  rideMode: 'private',
  pickup: null,
  destination: null,
  passengerCount: MIN_SEATS,
  route: null,
};

export const useBookingDraftStore = create<BookingDraftState>((set) => ({
  draft: emptyDraft,
  setRideMode: (rideMode) =>
    set((state) => ({
      draft: { ...state.draft, rideMode, passengerCount: rideMode === 'shared' ? 1 : state.draft.passengerCount },
    })),
  setPickup: (pickup) =>
    set((state) => ({
      draft: { ...state.draft, pickup },
    })),
  setDestination: (destination) =>
    set((state) => ({
      draft: { ...state.draft, destination },
    })),
  setPassengerCount: (count) =>
    set((state) => ({ draft: { ...state.draft, passengerCount: clamp(count) } })),
  setRoute: (route) =>
    set((state) => ({
      draft: { ...state.draft, route },
    })),
  reset: () => set({ draft: emptyDraft }),
}));

/**
 * Coordinate-equality tolerance used to decide whether a retained route still
 * belongs to the current inputs. Matches the routing query's rounding
 * (5 decimal places ≈ 1.1m) so a route accepted for a given pickup/destination
 * is considered current for those same rounded coordinates.
 */
const COORD_EPSILON = 1e-5;

function coordsMatch(a: LatLng | null | undefined, b: LatLng | null | undefined): boolean {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < COORD_EPSILON && Math.abs(a.lng - b.lng) < COORD_EPSILON;
}

/**
 * Whether the draft's accepted route was computed for the draft's *current*
 * pickup and destination (§13.2). A route with no recorded source is treated as
 * matching (legacy/manually-set routes). Returns false when either endpoint is
 * missing — there is nothing to draw a current route for.
 */
export function routeMatchesInputs(
  draft: Pick<BookingDraft, 'route' | 'pickup' | 'destination'>
): boolean {
  const { route, pickup, destination } = draft;
  if (!route) return false;
  if (!route.source) return true;
  return (
    coordsMatch(route.source.pickup, pickup?.coords ?? null) &&
    coordsMatch(route.source.destination, destination?.coords ?? null)
  );
}
