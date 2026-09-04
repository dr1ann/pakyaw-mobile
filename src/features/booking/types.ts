/**
 * Domain types for the passenger booking feature (Phase 6).
 *
 * Scope: trip creation only. Lifecycle states beyond 'requested' (matched,
 * accepted, arrived, in_progress, completed) belong to later phases and
 * are deliberately not modeled here.
 */

import type { Place } from '@pakyaw/shared/types/place';
import type { RideMode, RouteSnapshot } from '@pakyaw/shared/transport/contract';

export type BookingRideSelection = 'private' | 'shared';

export const BOOKING_RIDE_MODE_MAP: Readonly<Record<BookingRideSelection, RideMode>> = {
  private: 'solo',
  shared: 'shared',
};

export function toRideMode(selection: BookingRideSelection): RideMode {
  return BOOKING_RIDE_MODE_MAP[selection];
}

/**
 * Input accepted by booking.service.createTrip.
 * passengerCount is the requested rider/seat count; the backend derives
 * billedSeats and authoritative fare.
 */
export type CreateBookingInput = {
  readonly mode: RideMode;
  readonly pickup: Place;
  readonly destination: Place;
  readonly passengerCount: number;
  readonly route: RouteSnapshot;
  readonly displayedFare?: number | null;
  readonly bookingFor?: 'self' | 'other';
  readonly rider?: { firstName: string } | null;
  readonly pickupNote?: string | null;
};
