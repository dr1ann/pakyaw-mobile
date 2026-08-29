/**
 * Phase 8A/8B — Trip lifecycle domain types.
 *
 * The trip document status field drives every screen transition.
 * This module defines the closed status union, the forward-only
 * transition matrix enforced by the callable backend and the canonical
 * pakyaw-admin/firestore.rules,
 * and the TripDoc shape read from Firestore snapshots.
 */

import type { Timestamp } from 'firebase/firestore';

import type { Place } from '@pakyaw/shared/types/place';
import type {
  DriverPublicSnapshot,
  RideMode,
  TripStatus,
} from '@pakyaw/shared/transport/contract';

export type {
  DriverPublicSnapshot,
  RideMode,
  TripStatus,
} from '@pakyaw/shared/transport/contract';

/**
 * Client-side representation of a trips/{tripId} document.
 * Timestamps may be null when pending server commit (optimistic writes).
 */
export type TripDoc = {
  readonly id: string;
  readonly mode: RideMode;
  readonly status: TripStatus;
  readonly passengerId: string;
  readonly passengerName?: string;
  readonly passengerPhotoUrl?: string;
  readonly driverId: string | null;
  readonly driverPublic?: DriverPublicSnapshot | null;
  readonly pickup: Place;
  readonly destination: Place;
  readonly passengerCount: number;
  readonly billedSeats: number;
  readonly geohash: string;
  readonly requestedAt: Timestamp | null;
  readonly acceptedAt: Timestamp | null;
  readonly completedAt: Timestamp | null;
  readonly cancelledAt: Timestamp | null;
  readonly cancelledBy: CancelledBy | null;
  readonly cancelReason: string | null;
  readonly matching?: {
    readonly stage: 'initial' | 'second' | 'final' | 'timed_out';
    readonly radiusKm?: number;
  } | null;
  readonly fare?: number;
  readonly fareBreakdown?: {
    readonly baseFare: number;
    readonly distanceFare: number;
    readonly surcharges: number;
    readonly techFee: number;
    readonly driverEarnings: number;
    readonly paymentStatus?: 'paid' | 'pending';
  };

  // Shared Ride Fields
  readonly sharedRideId?: string | null;
  readonly seatsCovered?: number;
  readonly pickupFee?: number;
  readonly techFee?: number;

  // Phase 12 - route, driverToPickup, and serviceAreaId (optional for backward compatibility)
  readonly route?: {
    readonly distanceMeters: number;
    readonly durationSeconds: number;
    readonly polyline: string;
    readonly fetchedAt: Timestamp | null;
  } | null;
  readonly driverRoute?: {
    readonly polyline: string;
    readonly distanceMeters: number;
    readonly durationSeconds: number;
    readonly updatedAt: Timestamp | null;
  } | null;
  readonly tripProgress?: {
    readonly remainingMeters: number;
    readonly etaSeconds: number;
    readonly updatedAt: Timestamp | null;
  } | null;
  readonly serviceAreaId?: 'ormoc' | null;
};

export type SharedRideStatus = 'active' | 'completing' | 'completed';

export type SharedRidePassenger = {
  readonly tripId: string;
  readonly passengerId: string;
  readonly passengerName?: string;
  readonly passengerPhotoUrl?: string;
  readonly seatsCovered: number;
  readonly pickup: Place;
  readonly destination: Place;
  readonly status: 'active' | 'dropped_off';
  readonly isHop?: boolean;
  readonly fare?: number;
  readonly fareBreakdown?: {
    readonly baseFare: number;
    readonly distanceFare: number;
    readonly surcharges: number;
    readonly techFee: number;
    readonly driverEarnings: number;
    readonly paymentStatus?: 'paid' | 'pending';
  };
};

export type SharedRideDoc = {
  readonly id: string;
  readonly driverId: string;
  readonly driverName?: string;
  readonly driverPhotoUrl?: string;
  readonly driverPhone?: string;
  readonly vehicleModel?: string;
  readonly vehiclePlate?: string;
  readonly status: SharedRideStatus;
  readonly maxSeats: number;
  readonly seatsBooked: number;
  readonly totalPassengersCount?: number;
  readonly isLockedForHops?: boolean;
  readonly routePolyline: string;
  readonly routeOrigin: { readonly lat: number; readonly lng: number };
  readonly routeDestination: { readonly lat: number; readonly lng: number };
  readonly routeGeohash: string;
  readonly routeHeadingDeg: number;
  readonly corridorThresholdMeters: number;
  readonly tripIds: readonly string[];
  readonly passengers: readonly SharedRidePassenger[];
  readonly createdAt: Timestamp | null;
  readonly completedAt: Timestamp | null;
};

/**
 * Forward-only transition matrix. Each key maps to the set of statuses
 * it may transition INTO. Terminal states map to empty arrays.
 *
 * Note: requested → accepted is handled exclusively by the server offer-acceptance callable.
 * and is intentionally absent here.
 */
export const ALLOWED_TRANSITIONS: Record<
  Exclude<TripStatus, 'requested'>,
  readonly TripStatus[]
> = {
  accepted: ['driver_arriving'],
  driver_arriving: ['driver_arrived'],
  driver_arrived: ['in_progress'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
} as const;

/**
 * Statuses from which a passenger may initiate a cancellation.
 * Terminal states (completed, cancelled) and in_progress are excluded.
 *
 * Cancellation is lifecycle-dependent (see trip.service.cancel):
 * - `requested` cancellation is retained as `cancelled` by the server so the
 *   trip history and audit record are preserved.
 * - 'accepted' | 'driver_arriving' | 'driver_arrived' (post-acceptance): the
 *   document is retained and its status moves to 'cancelled'.
 */
export const CANCELLABLE_STATUSES: readonly TripStatus[] = [
  'requested',
  'accepted',
  'driver_arriving',
  'driver_arrived',
] as const;

export type CancelledBy = 'driver' | 'passenger';

export type CancelReason =
  | 'passenger_changed_mind'
  | 'driver_unavailable'
  | 'unable_to_locate_passenger'
  | 'vehicle_issue'
  | 'safety_concern'
  | 'other';

/**
 * Statuses during which the passenger should receive live driver location.
 * Subscription is inactive during requested and terminal states.
 */
export const DRIVER_LOCATION_ACTIVE_STATUSES: readonly TripStatus[] = [
  'accepted',
  'driver_arriving',
  'driver_arrived',
  'in_progress',
] as const;
