/**
 * Phase 7 — Driver matching domain types.
 *
 * Scope: incoming request representation and accept input shape only.
 * Lifecycle states beyond 'accepted' belong to later phases.
 */

import type { Place } from '@pakyaw/shared/types/place';

/**
 * A server-created trip offer visible only to its intended driver.
 */
export type IncomingRequest = {
  readonly tripId: string;
  /** Stable tripOffers document ID; required for callable acceptance. */
  readonly offerId: string;
  readonly passengerId: string;
  readonly mode?: 'solo' | 'shared' | 'hopon' | 'hop';
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
  readonly offeredAt?: number;
  readonly expiresAt?: number;
};

/**
 * Input accepted by matching.service.acceptTrip.
 */
export type AcceptTripInput = {
  readonly tripId: string;
  readonly offerId: string;
  readonly driverUid: string;
};
