import {
  collection,
  doc,
  firestore,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  FirebaseError,
  type DocumentData,
  type Timestamp as TimestampType,
} from '@/services/firebase/firebase';

import {
  NetworkError,
  NotFoundError,
  PermissionError,
  TripHistoryServiceError,
} from '@pakyaw/shared/features/trip-history/errors';
import type { HistoryCursor, TripDetail, TripHistoryItem } from '@pakyaw/shared/features/trip-history/types';
import { logger } from '@pakyaw/shared/lib/logger';
import { isDriverPublicSnapshot, isRideMode } from '@pakyaw/shared/transport/contract';

/** Historical trip reads may encounter documents written before Phase 1. */
function historicalRideMode(value: unknown): TripDetail['mode'] {
  return isRideMode(value) ? value : 'solo';
}

function terminalHistoryStatus(value: unknown): 'completed' | 'cancelled' | null {
  return value === 'completed' || value === 'cancelled' ? value : null;
}

function historyPlace(value: unknown, fallbackLabel: string): TripDetail['pickup'] {
  if (!value || typeof value !== 'object') return { label: fallbackLabel, coords: null };
  const place = value as Record<string, unknown>;
  const nestedCoords = place.coords && typeof place.coords === 'object'
    ? place.coords as Record<string, unknown>
    : null;
  const lat = typeof nestedCoords?.lat === 'number'
    ? nestedCoords.lat
    : typeof place.latitude === 'number'
      ? place.latitude
      : typeof place.lat === 'number'
        ? place.lat
        : null;
  const lng = typeof nestedCoords?.lng === 'number'
    ? nestedCoords.lng
    : typeof place.longitude === 'number'
      ? place.longitude
      : typeof place.lng === 'number'
        ? place.lng
        : null;
  return {
    label: typeof place.label === 'string' ? place.label : typeof place.address === 'string' ? place.address : fallbackLabel,
    address: typeof place.address === 'string' ? place.address : undefined,
    coords: lat !== null && lng !== null ? { lat, lng } : null,
  };
}

function authoritativeFareTotal(data: DocumentData): number | null {
  const candidates = [
    data.fare && typeof data.fare === 'object' ? (data.fare as Record<string, unknown>).total : undefined,
    data.fareBreakdown && typeof data.fareBreakdown === 'object'
      ? (data.fareBreakdown as Record<string, unknown>).total
      : undefined,
    typeof data.fare === 'number' ? data.fare : undefined,
  ];
  const total = candidates.find((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  return typeof total === 'number' ? total : null;
}

function authoritativeRoute(data: DocumentData): TripDetail['route'] {
  const route = data.route;
  if (!route || typeof route !== 'object' || typeof route.distanceMeters !== 'number' || !Number.isFinite(route.distanceMeters)) {
    return null;
  }
  return {
    distanceMeters: route.distanceMeters,
    durationSeconds: typeof route.durationSeconds === 'number' && Number.isFinite(route.durationSeconds)
      ? route.durationSeconds
      : 0,
    polyline: typeof route.polyline === 'string' ? route.polyline : '',
    fetchedAt: (route.fetchedAt as TimestampType) ?? null,
  };
}

function safeBookingFor(value: unknown): 'self' | 'other' | null {
  return value === 'self' || value === 'other' ? value : null;
}

function translateFirebaseError(err: unknown): Error {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'permission-denied':
        return new PermissionError('You do not have permission to access this trip.');
      case 'not-found':
        return new NotFoundError('The requested trip was not found.');
      case 'unavailable':
      case 'deadline-exceeded':
        return new NetworkError();
      default:
        return new TripHistoryServiceError(`Firestore operation failed: ${err.message}`, err);
    }
  }
  if (err instanceof Error) {
    return err;
  }
  return new TripHistoryServiceError('An unexpected error occurred.', err);
}

function mapDocToTripHistoryItem(id: string, data: DocumentData): TripHistoryItem {
  const driverPublic = isDriverPublicSnapshot(data.driverPublic) ? data.driverPublic : null;
  const historicalDriver = data.driver && typeof data.driver === 'object' ? data.driver : null;
  const driver = driverPublic
    ? {
        displayName: driverPublic.displayName,
        plate: driverPublic.vehicle.plateNumber,
        vehicleType: driverPublic.vehicle.type ?? null,
        profilePhotoUrl: driverPublic.profilePhotoUrl ?? null,
      }
    : historicalDriver && (typeof historicalDriver.displayName === 'string' || typeof historicalDriver.plate === 'string')
      ? {
          displayName: typeof historicalDriver.displayName === 'string'
            ? historicalDriver.displayName
            : 'Driver details unavailable',
          plate: typeof historicalDriver.plate === 'string' ? historicalDriver.plate : 'Plate unavailable',
          vehicleType: null,
          profilePhotoUrl: null,
        }
      : null;
  const route = authoritativeRoute(data);
  return {
    tripId: id,
    status: data.status === 'completed' ? 'completed' : 'cancelled',
    mode: historicalRideMode(data.mode),
    pickup: {
      label: data.pickup?.label ?? data.pickup?.address ?? 'Unknown Pickup',
    },
    destination: {
      label: data.destination?.label ?? data.destination?.address ?? 'Unknown Destination',
    },
    passengerCount: (data.passengerCount as number) ?? 1,
    fareTotal: authoritativeFareTotal(data),
    routeDistanceMeters: route?.distanceMeters ?? null,
    requestedAt: (data.requestedAt as TimestampType) ?? null,
    completedAt: (data.completedAt as TimestampType) ?? null,
    cancelledAt: (data.cancelledAt as TimestampType) ?? null,
    driver,
    bookingFor: safeBookingFor(data.bookingFor),
    riderFirstName: data.rider && typeof data.rider === 'object' && typeof data.rider.firstName === 'string'
      ? data.rider.firstName
      : null,
  };
}

export async function listForPassenger(
  uid: string,
  options: { limit: number; cursor: HistoryCursor | null },
): Promise<{ trips: TripHistoryItem[]; nextCursor: HistoryCursor | null }> {
  try {
    let q = query(
      collection(firestore, 'trips'),
      where('passengerId', '==', uid),
      where('status', 'in', ['completed', 'cancelled']),
      orderBy('requestedAt', 'desc'),
      fsLimit(options.limit),
    );

    if (options.cursor) {
      const ts = new Timestamp(options.cursor.seconds, options.cursor.nanoseconds);
      q = query(q, startAfter(ts));
    }

    const snap = await getDocs(q);
    const trips = snap.docs.map((d: any) => mapDocToTripHistoryItem(d.id, d.data()));

    const lastTrip = trips[trips.length - 1];
    const nextCursor =
      snap.docs.length === options.limit && lastTrip && lastTrip.requestedAt
        ? {
            seconds: lastTrip.requestedAt.seconds,
            nanoseconds: lastTrip.requestedAt.nanoseconds,
          }
        : null;

    return { trips, nextCursor };
  } catch (err) {
    logger.error('[trip-history] listForPassenger failed', { err, uid });
    throw translateFirebaseError(err);
  }
}

export async function getTrip(tripId: string): Promise<TripDetail> {
  try {
    const snap = await getDoc(doc(firestore, 'trips', tripId));
    if (!snap.exists()) {
      throw new NotFoundError();
    }
    const data = snap.data();
    const status = terminalHistoryStatus(data.status);
    if (!status) {
      throw new NotFoundError('This trip is not available in Activity yet.');
    }
    const driverPublic = isDriverPublicSnapshot(data.driverPublic) ? data.driverPublic : null;
    const historicalDriver = data.driver && typeof data.driver === 'object' ? data.driver : null;
    return {
      id: snap.id,
      mode: historicalRideMode(data.mode),
      status,
      passengerId: typeof data.passengerId === 'string' ? data.passengerId : '',
      driverId: data.driverId ?? null,
      pickup: historyPlace(data.pickup, 'Unknown pickup'),
      destination: historyPlace(data.destination, 'Unknown destination'),
      passengerCount: typeof data.passengerCount === 'number' ? data.passengerCount : 1,
      billedSeats: typeof data.billedSeats === 'number' ? data.billedSeats : 1,
      geohash: typeof data.geohash === 'string' ? data.geohash : '',
      requestedAt: (data.requestedAt as TimestampType) ?? null,
      acceptedAt: (data.acceptedAt as TimestampType) ?? null,
      completedAt: (data.completedAt as TimestampType) ?? null,
      cancelledAt: (data.cancelledAt as TimestampType) ?? null,
      cancelledBy: data.cancelledBy ?? null,
      cancelReason: data.cancelReason ?? null,
      bookingFor: safeBookingFor(data.bookingFor),
      rider: data.rider && typeof data.rider === 'object' && typeof data.rider.firstName === 'string'
        ? { firstName: data.rider.firstName }
        : null,
      fare: authoritativeFareTotal(data) ?? undefined,
      route: authoritativeRoute(data),
      driverPublic,
      driver: driverPublic
        ? {
            displayName: driverPublic.displayName,
            plate: driverPublic.vehicle.plateNumber,
            vehicleType: driverPublic.vehicle.type ?? null,
            profilePhotoUrl: driverPublic.profilePhotoUrl ?? null,
          }
        : historicalDriver && (typeof historicalDriver.displayName === 'string' || typeof historicalDriver.plate === 'string')
          ? {
              displayName: typeof historicalDriver.displayName === 'string'
                ? historicalDriver.displayName
                : 'Driver details unavailable',
              plate: typeof historicalDriver.plate === 'string' ? historicalDriver.plate : 'Plate unavailable',
              vehicleType: null,
              profilePhotoUrl: null,
            }
          : null,
    };
  } catch (err) {
    logger.error('[trip-history] getTrip failed', { err, tripId });
    throw translateFirebaseError(err);
  }
}
