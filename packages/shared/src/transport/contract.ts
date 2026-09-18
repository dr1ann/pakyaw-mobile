export type Timestamp = {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate?(): Date;
  toMillis?(): number;
};

export const RIDE_MODES = ['solo', 'shared'] as const;
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

/** Stored-trip marker used to keep malformed current records fail-closed. */
export const TRIP_SCHEMA_VERSION = 1 as const;

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
export const DEFAULT_VEHICLE_CAPACITY = 6;
export const DEFAULT_SOLO_MIN_BILLED_SEATS = 6;
export const DEFAULT_SHARED_MAX_SEATS_PER_BOOKING = 3;

/** Public, non-pricing transport settings returned to mobile clients. */
export type PublicTransportConfig = {
  readonly schemaVersion: number;
  readonly vehicleCapacity: number;
  readonly modes: {
    readonly solo: {
      readonly enabled: boolean;
      readonly minPassengers: number;
      readonly maxPassengers: number;
      readonly minimumBilledSeats: number;
      readonly buyoutSeats: number;
    };
    readonly shared: {
      readonly enabled: boolean;
      readonly maxSeatsPerBooking: number;
      readonly maxSeats: number;
    };
  };
  readonly pricing: {
    readonly currency: 'PHP';
  };
};

export const DEFAULT_PUBLIC_TRANSPORT_CONFIG: PublicTransportConfig = {
  schemaVersion: 2,
  vehicleCapacity: DEFAULT_VEHICLE_CAPACITY,
  modes: {
    solo: {
      enabled: true,
      minPassengers: 1,
      maxPassengers: DEFAULT_VEHICLE_CAPACITY,
      minimumBilledSeats: DEFAULT_SOLO_MIN_BILLED_SEATS,
      buyoutSeats: DEFAULT_SOLO_MIN_BILLED_SEATS,
    },
    shared: {
      enabled: true,
      maxSeatsPerBooking: DEFAULT_SHARED_MAX_SEATS_PER_BOOKING,
      maxSeats: DEFAULT_VEHICLE_CAPACITY,
    },
  },
  pricing: { currency: 'PHP' },
};

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
  /** Immutable explanatory fare snapshot. `total` and `techFee` remain compatibility aliases. */
  perSeat: {
    baseFare: number;
    succeedingKmCharge: number;
    distanceFare: number;
    surchargeTotal: number;
    transportFare: number;
  };
  billedSeats: number;
  transportFare: number;
  surcharges: {
    items: Array<{ code: 'night'; amount: number; application: 'per_trip' }>;
    total: number;
  };
  serviceFee: {
    configuredAmount: number;
    passengerPaid: number;
    driverContribution: number;
    driverBonus: number;
    platformReceivable: number;
  };
  feeTreatment: { scheme: FareTreatmentScheme };
  passengerTotal: number;
  platformReceivable: number;
  configSchemaVersion: 1 | 2;
  /** Compatibility fields for existing Trip readers. */
  baseFare: number;
  succeedingKmCharge: number;
  distanceFare: number;
  techFee: number;
  total: number;
  driverEarnings: number;
};

/** Historical scalar fare shape accepted only by compatibility readers. */
export type LegacyFareBreakdown = {
  baseFare?: number;
  succeedingKmCharge?: number;
  distanceFare?: number;
  surcharges?: number;
  techFee?: number;
  total: number;
  driverEarnings?: number;
  serviceFee?: number;
  perSeat?: {
    baseFare: number;
    succeedingKmCharge: number;
    distanceFare: number;
    surchargeTotal: number;
    transportFare: number;
  };
};

export type FareBreakdownView = FareBreakdown | LegacyFareBreakdown;

export type FareTreatmentScheme =
  | 'full_pass_on'
  | 'driver_subsidized'
  | 'split_fee'
  | 'driver_commission'
  | 'distance_tier_fee';

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Validate the backend-generated structured fare snapshot at a read boundary. */
export function isFareBreakdown(value: unknown): value is FareBreakdown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const fare = value as Record<string, unknown>;
  const perSeat = fare.perSeat;
  const surcharges = fare.surcharges;
  const serviceFee = fare.serviceFee;
  const feeTreatment = fare.feeTreatment;
  if (perSeat === null || typeof perSeat !== 'object' || Array.isArray(perSeat)
    || surcharges === null || typeof surcharges !== 'object' || Array.isArray(surcharges)
    || serviceFee === null || typeof serviceFee !== 'object' || Array.isArray(serviceFee)
    || feeTreatment === null || typeof feeTreatment !== 'object' || Array.isArray(feeTreatment)) return false;
  const seat = perSeat as Record<string, unknown>;
  const surcharge = surcharges as Record<string, unknown>;
  const fee = serviceFee as Record<string, unknown>;
  const treatment = feeTreatment as Record<string, unknown>;
  const items = surcharge.items;
  return Array.isArray(items)
    && [
      seat.baseFare, seat.succeedingKmCharge, seat.distanceFare, seat.surchargeTotal,
      seat.transportFare, fare.billedSeats, fare.transportFare, surcharge.total,
      fee.configuredAmount, fee.passengerPaid, fee.driverContribution, fee.driverBonus,
      fee.platformReceivable, fare.passengerTotal, fare.platformReceivable,
      fare.baseFare, fare.succeedingKmCharge, fare.distanceFare, fare.techFee,
      fare.total, fare.driverEarnings,
    ].every(finiteNonNegative)
    && Number.isInteger(fare.billedSeats)
    && (fare.billedSeats as number) >= 1
    && items.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item)
      && (item as Record<string, unknown>).code === 'night'
      && finiteNonNegative((item as Record<string, unknown>).amount)
      && (item as Record<string, unknown>).application === 'per_trip')
    && typeof treatment.scheme === 'string'
    && ['full_pass_on', 'driver_subsidized', 'split_fee', 'driver_commission', 'distance_tier_fee'].includes(treatment.scheme)
    && (fare.configSchemaVersion === 1 || fare.configSchemaVersion === 2);
}

/** Validate only the scalar fare shape used by historical compatibility readers. */
export function isLegacyFareBreakdown(value: unknown): value is LegacyFareBreakdown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const fare = value as Record<string, unknown>;
  return finiteNonNegative(fare.total)
    && [fare.baseFare, fare.succeedingKmCharge, fare.distanceFare, fare.surcharges,
      fare.techFee, fare.driverEarnings, fare.serviceFee].every(
      (field) => field === undefined || finiteNonNegative(field),
    );
}

export function getFareSurchargeTotal(fare: FareBreakdownView): number {
  return typeof fare.surcharges === 'number' ? fare.surcharges : fare.surcharges?.total ?? 0;
}

export type TripOfferFare = {
  total: number;
  driverEarnings: number;
};

export type DriverPublicSnapshot = {
  driverId: string;
  displayName: string;
  profilePhotoUrl?: string | null;
  vehicle: {
    type?: string | null;
    description?: string | null;
    plateNumber: string;
    unitBodyNumber?: string | null;
  };
  verification: { verified: true };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

/** Accept only the backend-generated, Passenger-safe identity shape. */
export function isDriverPublicSnapshot(value: unknown): value is DriverPublicSnapshot {
  if (!isRecord(value)
    || typeof value.driverId !== 'string'
    || value.driverId.trim().length === 0
    || typeof value.displayName !== 'string'
    || value.displayName.trim().length === 0
    || !isRecord(value.vehicle)
    || typeof value.vehicle.plateNumber !== 'string'
    || value.vehicle.plateNumber.trim().length === 0
    || !isRecord(value.verification)
    || value.verification.verified !== true) {
    return false;
  }
  if (!hasOnlyKeys(value, ['driverId', 'displayName', 'profilePhotoUrl', 'vehicle', 'verification'])
    || !hasOnlyKeys(value.vehicle, ['type', 'description', 'plateNumber', 'unitBodyNumber'])
    || !hasOnlyKeys(value.verification, ['verified'])) return false;
  return (value.profilePhotoUrl === undefined || value.profilePhotoUrl === null || typeof value.profilePhotoUrl === 'string')
    && (value.vehicle.type === undefined || value.vehicle.type === null || typeof value.vehicle.type === 'string')
    && (value.vehicle.description === undefined || value.vehicle.description === null || typeof value.vehicle.description === 'string')
    && (value.vehicle.unitBodyNumber === undefined || value.vehicle.unitBodyNumber === null || typeof value.vehicle.unitBodyNumber === 'string');
}

export type LegacyRideMode = 'hop';
export type LegacyHistoryRideMode = LegacyRideMode | 'pakyaw';
export type HistoricalRideMode = RideMode | LegacyHistoryRideMode;
/** @deprecated Use RideMode for current transport documents or HistoricalRideMode for readers. */
export type AnyRideMode = HistoricalRideMode;

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

  bookingFor?: 'self' | 'other';
  rider?: { firstName: string } | null;
  pickupNote?: string | null;

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
  sharedRideId?: string;

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

  bookingFor?: 'self' | 'other';
  rider?: { firstName: string } | null;
  pickupNote?: string | null;
};

export type QuoteTripInput = Omit<RequestTripInput, 'passengerId' | 'displayedFare'>;

export type QuoteTripResult = {
  readonly mode: RideMode;
  readonly passengerCount: number;
  readonly billedSeats: number;
  readonly fare: FareBreakdown;
};

export type PassengerCountLimits = {
  readonly vehicleCapacity?: number;
  readonly maxSeatsPerBooking?: number;
};

export function isPassengerCountAllowed(
  mode: RideMode,
  passengerCount: number,
  limits?: PassengerCountLimits,
): boolean {
  const max = mode === 'shared'
    ? limits?.maxSeatsPerBooking ?? MAX_PASSENGER_COUNT
    : limits?.vehicleCapacity ?? MAX_PASSENGER_COUNT;
  return Number.isInteger(passengerCount)
    && passengerCount >= 1
    && Number.isInteger(max)
    && max >= 1
    && passengerCount <= max;
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
  mode?: 'shared' | 'hop';
  status: SharedRideMemberStatus;
};

export type SharedRideOperationalStop = {
  readonly id: string;
  readonly tripId: string;
  readonly kind: 'pickup' | 'dropoff';
  readonly place: LatLng;
  readonly status: 'pending' | 'completed' | 'cancelled';
};

export type SharedRideOperational = {
  readonly stopOrder: string[];
  readonly currentStopId: string | null;
  readonly nextStopId: string | null;
  readonly stops: SharedRideOperationalStop[];
};

export type SharedRideSummary = {
  seatsOccupied: number;
  maxSeats: number;
  passengerGroups: number;
};

export type SharedRide = {
  driverId: string;
  originMode?: 'shared';
  driverLocationGeohash?: string;
  status: SharedRideStatus;

  maxSeats: number;
  seatsReserved: number;

  tripIds: string[];
  members: SharedRideMember[];
  operational?: SharedRideOperational;

  route: RouteSnapshot;

  createdAt: Timestamp;
  updatedAt: Timestamp;
};
