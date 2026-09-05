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
  QueryIndexError,
  TripHistoryServiceError,
} from '@pakyaw/shared/features/trip-history/errors';
import type { HistoryCursor, TripDetail, TripHistoryItem } from '@pakyaw/shared/features/trip-history/types';
import { logger } from '@pakyaw/shared/lib/logger';
import { isDriverPublicSnapshot } from '@pakyaw/shared/transport/contract';

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
      case 'failed-precondition':
        // A missing Firestore composite index produces a failed-precondition error
        // whose message contains a console.firebase.google.com URL. We must never
        // surface that raw URL to the driver UI.
        return new QueryIndexError();
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
    ? { displayName: driverPublic.displayName, plate: driverPublic.vehicle.plateNumber }
    : historicalDriver && (typeof historicalDriver.displayName === 'string' || typeof historicalDriver.plate === 'string')
      ? {
          displayName: typeof historicalDriver.displayName === 'string'
            ? historicalDriver.displayName
            : 'Driver details unavailable',
          plate: typeof historicalDriver.plate === 'string' ? historicalDriver.plate : 'Plate unavailable',
        }
      : null;

  const rawFare = data.fareBreakdown ?? data.fare;
  const driverEarnings = typeof rawFare?.driverEarnings === 'number'
    ? rawFare.driverEarnings
    : typeof rawFare?.driverFare === 'number'
      ? rawFare.driverFare
      : null;

  const fareTotal = typeof rawFare?.total === 'number'
    ? rawFare.total
    : typeof data.fare === 'number'
      ? data.fare
      : null;

  const rider = data.rider && typeof data.rider.firstName === 'string'
    ? { firstName: data.rider.firstName }
    : null;

  return {
    tripId: id,
    status: data.status as string,
    mode: data.mode === 'shared' ? 'shared' : data.mode === 'pakyaw' ? 'pakyaw' : (data.mode ?? 'solo'),
    pickup: {
      label: data.pickup?.label ?? data.pickup?.address ?? 'Unknown Pickup',
    },
    destination: {
      label: data.destination?.label ?? data.destination?.address ?? 'Unknown Destination',
    },
    passengerCount: (data.passengerCount as number) ?? 1,
    billedSeats: (data.billedSeats as number) ?? (data.passengerCount as number) ?? 1,
    requestedAt: (data.requestedAt as TimestampType) ?? null,
    completedAt: (data.completedAt as TimestampType) ?? null,
    cancelledAt: (data.cancelledAt as TimestampType) ?? null,
    driverEarnings,
    fareTotal,
    driver,
    rider,
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

export async function listForDriver(
  uid: string,
  options: { limit: number; cursor: HistoryCursor | null },
): Promise<{ trips: TripHistoryItem[]; nextCursor: HistoryCursor | null }> {
  try {
    let q = query(
      collection(firestore, 'trips'),
      where('driverId', '==', uid),
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
    logger.error('[trip-history] listForDriver failed', { err, uid });
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
    const driverPublic = isDriverPublicSnapshot(data.driverPublic) ? data.driverPublic : null;
    const historicalDriver = data.driver && typeof data.driver === 'object' ? data.driver : null;
    const rawFare = data.fareBreakdown ?? data.fare;
    const fareBreakdown = typeof rawFare === 'object' && rawFare !== null ? rawFare : undefined;

    return {
      id: snap.id,
      mode: data.mode ?? 'solo',
      status: data.status,
      passengerId: data.passengerId,
      driverId: data.driverId ?? null,
      pickup: data.pickup,
      destination: data.destination,
      passengerCount: data.passengerCount ?? 1,
      billedSeats: data.billedSeats ?? data.passengerCount ?? 1,
      geohash: data.geohash,
      fare: typeof data.fare === 'number' ? data.fare : fareBreakdown?.total,
      fareBreakdown,
      rider: data.rider && typeof data.rider.firstName === 'string' ? { firstName: data.rider.firstName } : null,
      bookingFor: data.bookingFor ?? null,
      pickupNote: data.pickupNote ?? null,
      route: data.route ? {
        distanceMeters: data.route.distanceMeters,
        durationSeconds: data.route.durationSeconds,
        polyline: data.route.polyline,
        fetchedAt: data.route.fetchedAt,
      } : null,
      sharedRideId: data.sharedRideId ?? null,
      sharedRideSummary: data.sharedRideSummary ?? null,
      requestedAt: (data.requestedAt as TimestampType) ?? null,
      acceptedAt: (data.acceptedAt as TimestampType) ?? null,
      completedAt: (data.completedAt as TimestampType) ?? null,
      cancelledAt: (data.cancelledAt as TimestampType) ?? null,
      cancelledBy: data.cancelledBy ?? null,
      cancelReason: data.cancelReason ?? null,
      driverPublic,
      driver: driverPublic
        ? {
            displayName: driverPublic.displayName,
            plate: driverPublic.vehicle.plateNumber,
          }
        : historicalDriver && (typeof historicalDriver.displayName === 'string' || typeof historicalDriver.plate === 'string')
          ? {
              displayName: typeof historicalDriver.displayName === 'string'
                ? historicalDriver.displayName
                : 'Driver details unavailable',
              plate: typeof historicalDriver.plate === 'string' ? historicalDriver.plate : 'Plate unavailable',
            }
          : null,
      passenger: null, // Privacy: Never expose private passenger PII
    };
  } catch (err) {
    logger.error('[trip-history] getTrip failed', { err, tripId });
    throw translateFirebaseError(err);
  }
}
