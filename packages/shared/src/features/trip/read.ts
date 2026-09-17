import type { TripDoc, Timestamp } from '@pakyaw/shared/features/trip/types';
import {
  isDriverPublicSnapshot,
  isFareBreakdown,
  isLegacyFareBreakdown,
  isRideMode,
  isTripStatus,
  TRIP_SCHEMA_VERSION,
  type FareBreakdownView,
  type HistoricalRideMode,
  type SharedRideSummary,
} from '@pakyaw/shared/transport/contract';

export type TripDocumentKind = 'canonical' | 'legacy';

export type TripDocumentRead = {
  readonly kind: TripDocumentKind;
  readonly trip: TripDoc;
  readonly historyMode: HistoricalRideMode;
  readonly driver: {
    readonly displayName: string;
    readonly plate: string;
  } | null;
};

type RecordValue = Record<string, unknown>;
type Route = NonNullable<TripDoc['route']>;
type DriverRoute = NonNullable<TripDoc['driverRoute']>;
type TripProgress = NonNullable<TripDoc['tripProgress']>;
type Place = TripDoc['pickup'];

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function integerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= minimum
    && value <= maximum;
}

function readTimestamp(value: unknown): Timestamp | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return null;
  const seconds = typeof value.seconds === 'number' ? value.seconds : null;
  const nanoseconds = typeof value.nanoseconds === 'number' ? value.nanoseconds : null;
  if (seconds === null
    || nanoseconds === null
    || !Number.isInteger(seconds)
    || !Number.isInteger(nanoseconds)
    || nanoseconds < 0
    || nanoseconds >= 1_000_000_000) {
    return null;
  }
  return value as Timestamp;
}

function readPlace(value: unknown): Place | null {
  if (!isRecord(value)
    || !finiteNumber(value.latitude)
    || value.latitude < -90
    || value.latitude > 90
    || !finiteNumber(value.longitude)
    || value.longitude < -180
    || value.longitude > 180
    || (value.label !== undefined && typeof value.label !== 'string')) {
    return null;
  }
  return {
    label: typeof value.label === 'string' ? value.label : 'Location',
    coords: { lat: value.latitude, lng: value.longitude },
  };
}

function legacyPlace(value: unknown): Place {
  return readPlace(value) ?? { label: 'Location', coords: null };
}

function readRoute(value: unknown): Route | null {
  if (!isRecord(value)
    || !finiteNumber(value.distanceMeters)
    || value.distanceMeters < 0
    || !finiteNumber(value.durationSeconds)
    || value.durationSeconds < 0
    || (value.polyline !== undefined && typeof value.polyline !== 'string')
    || (value.fetchedAt !== undefined && value.fetchedAt !== null && readTimestamp(value.fetchedAt) === null)) {
    return null;
  }
  return {
    distanceMeters: value.distanceMeters,
    durationSeconds: value.durationSeconds,
    polyline: typeof value.polyline === 'string' ? value.polyline : '',
    fetchedAt: readTimestamp(value.fetchedAt),
  };
}

function legacyRoute(value: unknown): Route | null {
  if (!isRecord(value)
    || !finiteNumber(value.distanceMeters)
    || value.distanceMeters < 0
    || (value.durationSeconds !== undefined
      && (!finiteNumber(value.durationSeconds) || value.durationSeconds < 0))
    || (value.polyline !== undefined && typeof value.polyline !== 'string')
    || (value.fetchedAt !== undefined && value.fetchedAt !== null && readTimestamp(value.fetchedAt) === null)) {
    return null;
  }
  return {
    distanceMeters: value.distanceMeters,
    durationSeconds: typeof value.durationSeconds === 'number' ? value.durationSeconds : 0,
    polyline: typeof value.polyline === 'string' ? value.polyline : '',
    fetchedAt: readTimestamp(value.fetchedAt),
  };
}

function readDriverRoute(value: unknown): DriverRoute | null {
  if (!isRecord(value)
    || typeof value.polyline !== 'string'
    || !finiteNumber(value.distanceMeters)
    || value.distanceMeters < 0
    || !finiteNumber(value.durationSeconds)
    || value.durationSeconds < 0
    || (value.updatedAt !== undefined && value.updatedAt !== null && readTimestamp(value.updatedAt) === null)) {
    return null;
  }
  return {
    polyline: value.polyline,
    distanceMeters: value.distanceMeters,
    durationSeconds: value.durationSeconds,
    updatedAt: readTimestamp(value.updatedAt),
  };
}

function readTripProgress(value: unknown): TripProgress | null {
  if (!isRecord(value)
    || !finiteNumber(value.remainingMeters)
    || value.remainingMeters < 0
    || !finiteNumber(value.etaSeconds)
    || value.etaSeconds < 0
    || (value.updatedAt !== undefined && value.updatedAt !== null && readTimestamp(value.updatedAt) === null)) {
    return null;
  }
  return {
    remainingMeters: value.remainingMeters,
    etaSeconds: value.etaSeconds,
    updatedAt: readTimestamp(value.updatedAt),
  };
}

function readFare(value: unknown): FareBreakdownView | undefined {
  return isFareBreakdown(value) || isLegacyFareBreakdown(value) ? value : undefined;
}

function readSummary(value: unknown): SharedRideSummary | null {
  if (!isRecord(value)
    || !integerInRange(value.seatsOccupied, 0, 6)
    || !integerInRange(value.maxSeats, 1, 6)
    || value.seatsOccupied > value.maxSeats
    || !integerInRange(value.passengerGroups, 0, 6)) {
    return null;
  }
  return {
    seatsOccupied: value.seatsOccupied,
    maxSeats: value.maxSeats,
    passengerGroups: value.passengerGroups,
  };
}

function readMatching(value: unknown): TripDoc['matching'] {
  if (!isRecord(value)
    || (value.stage !== 'initial'
      && value.stage !== 'second'
      && value.stage !== 'final'
      && value.stage !== 'timed_out')
    || (value.radiusKm !== undefined && (!finiteNumber(value.radiusKm) || value.radiusKm < 0))) {
    return null;
  }
  return {
    stage: value.stage,
    radiusKm: typeof value.radiusKm === 'number' ? value.radiusKm : undefined,
  };
}

function readBookingFor(value: unknown): 'self' | 'other' | null {
  return value === 'self' || value === 'other' ? value : null;
}

function readRider(value: unknown): { readonly firstName: string } | null {
  return isRecord(value) && nonEmptyString(value.firstName)
    ? { firstName: value.firstName.trim() }
    : null;
}

function readCancelledBy(value: unknown): 'driver' | 'passenger' | null {
  return value === 'driver' || value === 'passenger' ? value : null;
}

function readDriver(value: unknown): TripDocumentRead['driver'] {
  if (!isRecord(value)) return null;
  const displayName = nonEmptyString(value.displayName) ? value.displayName.trim() : null;
  const plate = nonEmptyString(value.plate) ? value.plate.trim() : null;
  return displayName || plate
    ? {
      displayName: displayName ?? 'Driver details unavailable',
      plate: plate ?? 'Plate unavailable',
    }
    : null;
}

function driverPresentation(data: RecordValue, driverPublic: TripDoc['driverPublic']): TripDocumentRead['driver'] {
  if (driverPublic) {
    return {
      displayName: driverPublic.displayName,
      plate: driverPublic.vehicle.plateNumber,
    };
  }
  return readDriver(data.driver);
}

/**
 * A schema marker is written by current server code. The remaining checks
 * recognize current documents written before the marker was introduced.
 * Legacy defaults are only permitted when none of those current markers are
 * present, so a malformed current record cannot be reinterpreted as legacy.
 */
export function isCurrentTripDocument(value: unknown): value is RecordValue {
  if (!isRecord(value)) return false;
  if (hasOwn(value, 'schemaVersion')) return true;
  // Before the marker existed, the structured fare was the only reliable
  // discriminator. Historical documents also contain billedSeats and partial
  // route/fareBreakdown values, so those fields alone must remain legacy-safe.
  if (isFareBreakdown(value.fare)) return true;
  return false;
}

function isCanonicalTrip(value: RecordValue): boolean {
  return (!hasOwn(value, 'schemaVersion') || value.schemaVersion === TRIP_SCHEMA_VERSION)
    && isRideMode(value.mode)
    && isTripStatus(value.status)
    && nonEmptyString(value.passengerId)
    && (value.driverId === null || nonEmptyString(value.driverId))
    && readPlace(value.pickup) !== null
    && readPlace(value.destination) !== null
    && integerInRange(value.passengerCount, 1, 6)
    && integerInRange(value.billedSeats, 1, 6)
    && isFareBreakdown(value.fare)
    && readRoute(value.route) !== null;
}

function mapTrip(id: string, data: RecordValue, canonical: boolean): TripDocumentRead | null {
  const driverPublic = isDriverPublicSnapshot(data.driverPublic) ? data.driverPublic : null;
  const fareBreakdown = readFare(data.fare) ?? readFare(data.fareBreakdown);
  const passengerCount = canonical
    ? data.passengerCount as number
    : integerInRange(data.passengerCount, 1, 6) ? data.passengerCount : 1;
  const billedSeats = canonical
    ? data.billedSeats as number
    : integerInRange(data.billedSeats, 1, 6) ? data.billedSeats : passengerCount;
  const historyMode: HistoricalRideMode = canonical && isRideMode(data.mode)
    ? data.mode
    : isRideMode(data.mode) ? data.mode : data.mode === 'hop' || data.mode === 'pakyaw' ? data.mode : 'solo';
  const mode: TripDoc['mode'] = isRideMode(historyMode) ? historyMode : 'solo';
  const status = canonical
    ? data.status as TripDoc['status']
    : isTripStatus(data.status) ? data.status : 'requested';
  const passengerId = nonEmptyString(data.passengerId) ? data.passengerId.trim() : null;
  if (passengerId === null) return null;

  const pickup = canonical ? readPlace(data.pickup) : legacyPlace(data.pickup);
  const destination = canonical ? readPlace(data.destination) : legacyPlace(data.destination);
  const route = canonical ? readRoute(data.route) : legacyRoute(data.route);
  if (pickup === null || destination === null || (canonical && route === null)) return null;

  const trip: TripDoc = {
    id,
    mode: mode as TripDoc['mode'],
    status,
    passengerId,
    driverId: data.driverId === null ? null : nonEmptyString(data.driverId) ? data.driverId.trim() : null,
    driverPublic,
    sharedRideId: nonEmptyString(data.sharedRideId) ? data.sharedRideId.trim() : null,
    sharedRideSummary: readSummary(data.sharedRideSummary),
    pickup,
    destination,
    passengerCount,
    billedSeats,
    geohash: typeof data.geohash === 'string' ? data.geohash : '',
    requestedAt: readTimestamp(data.requestedAt),
    acceptedAt: readTimestamp(data.acceptedAt),
    completedAt: readTimestamp(data.completedAt),
    cancelledAt: readTimestamp(data.cancelledAt),
    cancelledBy: readCancelledBy(data.cancelledBy),
    cancelReason: typeof data.cancelReason === 'string' ? data.cancelReason : null,
    matching: readMatching(data.matching),
    fare: typeof data.fare === 'number'
      ? data.fare
      : typeof fareBreakdown?.total === 'number' ? fareBreakdown.total : undefined,
    fareBreakdown,
    route,
    driverRoute: data.driverRoute === undefined || data.driverRoute === null ? null : readDriverRoute(data.driverRoute),
    tripProgress: data.tripProgress === undefined || data.tripProgress === null ? null : readTripProgress(data.tripProgress),
    serviceAreaId: data.serviceAreaId === 'ormoc' ? 'ormoc' : null,
    bookingFor: readBookingFor(data.bookingFor),
    rider: readRider(data.rider),
    pickupNote: typeof data.pickupNote === 'string' ? data.pickupNote : null,
  };

  return {
    kind: canonical ? 'canonical' : 'legacy',
    trip,
    historyMode,
    driver: driverPresentation(data, driverPublic),
  };
}

export function parseTripDocument(id: string, value: unknown): TripDocumentRead | null {
  if (!isRecord(value)) return null;
  const current = isCurrentTripDocument(value);
  if (current) return isCanonicalTrip(value) ? mapTrip(id, value, true) : null;
  return mapTrip(id, value, false);
}
