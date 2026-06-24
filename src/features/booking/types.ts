/**
 * Domain types for the passenger booking feature (Phase 6).
 *
 * Scope: trip creation only. Lifecycle states beyond 'request' (matched,
 * accepted, arrived, in_progress, completed) belong to later phases and
 * are deliberately not modeled here.
 */

import type { FieldValue } from 'firebase/firestore';

import type { LatLng } from '@/lib/geo';

/**
 * A named place the passenger can pick as pickup or destination.
 * Saved-place entries and ad-hoc free-text entries share this shape.
 */
export type Place = {
  readonly label: string;
  readonly address?: string;
  readonly coords: LatLng | null;
};

/**
 * Input accepted by booking.service.createTrip.
 * passengerCount is the raw UI value; the service re-derives billedSeats.
 */
export type CreateBookingInput = {
  readonly pickup: Place;
  readonly destination: Place;
  readonly passengerCount: number;
};

/**
 * Concrete shape written to trips/{tripId} at create time.
 * Lifecycle fields (matched/accepted/arrived/in_progress/completed) are not
 * written by this phase.
 */
export type TripCreateData = {
  readonly mode: 'solo';
  readonly passengerId: string;
  readonly driverId: null;
  readonly pickup: Place;
  readonly destination: Place;
  readonly passengerCount: number;
  readonly billedSeats: number;
  readonly status: 'request';
  readonly geohash: string;
  readonly requestedAt: FieldValue;
};
