/**
 * Domain types for the passenger booking feature (Phase 6).
 *
 * Scope: trip creation only. Lifecycle states beyond 'requested' (matched,
 * accepted, arrived, in_progress, completed) belong to later phases and
 * are deliberately not modeled here.
 */

import type { FieldValue } from 'firebase/firestore';

import type { Place } from '@pakyaw/shared/types/place';

/**
 * Input accepted by booking.service.createTrip.
 * passengerCount is the raw UI value; the service re-derives billedSeats.
 */
export type CreateBookingInput = {
  readonly mode?: 'private' | 'shared';
  readonly pickup: Place;
  readonly destination: Place;
  readonly passengerCount: number;
  readonly route: {
    readonly distanceMeters: number;
    readonly durationSeconds: number;
    readonly polyline: string;
  };
  readonly fare?: number;
};

/**
 * Concrete shape written to trips/{tripId} at create time.
 * Lifecycle fields (matched/accepted/arrived/in_progress/completed) are not
 * written by this phase.
 */
export type TripCreateData = {
  readonly mode: 'solo' | 'shared';
  readonly passengerId: string;
  readonly driverId: null;
  readonly pickup: Place;
  readonly destination: Place;
  readonly passengerCount: number;
  readonly billedSeats: number;
  readonly seatsCovered?: number;
  readonly status: 'requested';
  readonly geohash: string;
  readonly requestedAt: FieldValue;
  readonly createdTime: FieldValue;
  readonly fare?: number;
  readonly route: {
    readonly distanceMeters: number;
    readonly durationSeconds: number;
    readonly polyline: string;
  };
  readonly serviceAreaId: 'ormoc';
};
