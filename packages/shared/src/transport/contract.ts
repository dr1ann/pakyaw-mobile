import type { Timestamp } from 'firebase/firestore';

export const RIDE_MODES = ['solo', 'shared', 'hop'] as const;
export type RideMode = (typeof RIDE_MODES)[number];

export function isRideMode(value: unknown): value is RideMode {
  return typeof value === 'string' && (RIDE_MODES as readonly string[]).includes(value);
}

export const TRIP_STATUSES = [
  'requested',
  'accepted',
  'driver_arriving',
  'driver_arrived',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export function isTripStatus(value: unknown): value is TripStatus {
  return typeof value === 'string' && (TRIP_STATUSES as readonly string[]).includes(value);
}

export const TRIP_OFFER_STATUSES = ['pending', 'accepted', 'expired'] as const;
export type TripOfferStatus = (typeof TRIP_OFFER_STATUSES)[number];

export function isTripOfferStatus(value: unknown): value is TripOfferStatus {
  return typeof value === 'string' && (TRIP_OFFER_STATUSES as readonly string[]).includes(value);
}

export const SHARED_RIDES_COLLECTION = 'sharedRides' as const;
export const LEGACY_SHARED_RIDES_COLLECTION = 'shared_rides' as const;

export const INITIAL_PASSENGER_COUNT = 1;
export const INITIAL_BILLED_SEATS = 1;
export const MAX_PASSENGER_COUNT = 6;
export const MAX_HOP_SEATS_PER_PASSENGER = 1;

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type Place = LatLng & {
  label?: string;
};

export type RouteSnapshot = {
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
};

export type FareBreakdown = {
  baseFare: number;
  distanceFare: number;
  surcharges: number;
  techFee: number;
  total: number;
  driverEarnings?: number;
};

export type TripOfferFare = {
  total: number;
  driverEarnings: number;
};

export type DriverPublicSnapshot = {
  name: string;
  photoUrl?: string | null;
  vehicleType?: string | null;
  vehicleModel?: string | null;
  plateNumber?: string | null;
};

export type Trip = {
  passengerId: string;
  driverId: string | null;

  mode: RideMode;
  status: TripStatus;

  pickup: Place;
  destination: Place;
  route: RouteSnapshot;

  passengerCount: number;
  billedSeats: number;

  fare: FareBreakdown;

  sharedRideId?: string | null;
  sharedRideSummary?: SharedRideSummary | null;
  driverPublic?: DriverPublicSnapshot | null;

  requestedAt: Timestamp;
  acceptedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  cancelledAt?: Timestamp | null;
};

export type TripOffer = {
  tripId: string;
  driverId: string;

  mode: RideMode;

  pickup: Place;
  destination: Place;

  passengerCount: number;
  billedSeats: number;

  fare: TripOfferFare;

  status: TripOfferStatus;
  offeredAt: Timestamp;
  expiresAt: Timestamp;
};

export type RequestTripInput = {
  passengerId: string;
  mode: RideMode;

  pickup: Place;
  destination: Place;

  route: RouteSnapshot;

  passengerCount: number;

  displayedFare?: number | null;
};

export type QuoteTripInput = Omit<RequestTripInput, 'passengerId' | 'displayedFare'>;

export type QuoteTripResult = {
  readonly mode: RideMode;
  readonly passengerCount: number;
  readonly billedSeats: number;
  readonly fare: FareBreakdown;
};

export function isPassengerCountAllowed(mode: RideMode, passengerCount: number): boolean {
  return (
    Number.isInteger(passengerCount) &&
    passengerCount >= 1 &&
    passengerCount <= MAX_PASSENGER_COUNT &&
    (mode !== 'hop' || passengerCount <= MAX_HOP_SEATS_PER_PASSENGER)
  );
}

export type SharedRideStatus = 'forming' | 'active' | 'completed' | 'cancelled';

export type SharedRideMemberStatus =
  | 'reserved'
  | 'waiting_pickup'
  | 'onboard'
  | 'dropped_off'
  | 'cancelled';

export type SharedRideMember = {
  tripId: string;
  passengerId: string;
  seats: number;
  pickup: Place;
  destination: Place;
  status: SharedRideMemberStatus;
};

export type SharedRideSummary = {
  seatsOccupied: number;
  maxSeats: number;
  passengerGroups: number;
};

export type SharedRide = {
  driverId: string;
  status: SharedRideStatus;

  maxSeats: number;
  seatsReserved: number;

  tripIds: string[];
  members: SharedRideMember[];

  route: RouteSnapshot;

  createdAt: Timestamp;
  updatedAt: Timestamp;
};
