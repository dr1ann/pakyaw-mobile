/**
 * Phase 7 — Driver matching domain types.
 *
 * Scope: incoming request representation and accept input shape only.
 * Lifecycle states beyond 'accepted' belong to later phases.
 */

import type { Place } from '@pakyaw/shared/types/place';

/**
 * A trip request surfaced to nearby drivers via the geohash-prefix subscription.
 * Mirrors the subset of trips/{tripId} the driver UI needs to render the card.
 */
export type IncomingRequest = {
  readonly tripId: string;
  readonly passengerId: string;
  readonly mode?: 'solo' | 'shared' | 'hopon';
  readonly pickup: Place;
  readonly destination: Place;
  readonly passengerCount: number;
  readonly billedSeats: number;
  readonly seatsCovered?: number;
  readonly route?: {
    readonly distanceMeters: number;
    readonly durationSeconds: number;
    readonly polyline: string;
  } | null;
  readonly fare?: number;
};

/**
 * Input accepted by matching.service.acceptTrip.
 */
export type AcceptTripInput = {
  readonly tripId: string;
  readonly driverUid: string;
};
