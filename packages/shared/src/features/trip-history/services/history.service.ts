import { FirebaseError } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
} from 'firebase/firestore';

import {
  NetworkError,
  NotFoundError,
  PermissionError,
  TripHistoryServiceError,
} from '@pakyaw/shared/features/trip-history/errors';
import type { HistoryCursor, TripDetail, TripHistoryItem } from '@pakyaw/shared/features/trip-history/types';
import { logger } from '@pakyaw/shared/lib/logger';
import { isDriverPublicSnapshot } from '@pakyaw/shared/transport/contract';
import { firestore } from '@/services/firebase/firebase';

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
    ? { displayName: driverPublic.displayName, plate: driverPublic.vehicle.plateNumber }
    : historicalDriver && (typeof historicalDriver.displayName === 'string' || typeof historicalDriver.plate === 'string')
      ? {
          displayName: typeof historicalDriver.displayName === 'string'
            ? historicalDriver.displayName
            : 'Driver details unavailable',
          plate: typeof historicalDriver.plate === 'string' ? historicalDriver.plate : 'Plate unavailable',
        }
      : null;
  return {
    tripId: id,
    status: data.status as string,
    pickup: {
      label: data.pickup?.label ?? data.pickup?.address ?? 'Unknown Pickup',
    },
    destination: {
      label: data.destination?.label ?? data.destination?.address ?? 'Unknown Destination',
    },
    passengerCount: (data.passengerCount as number) ?? 1,
    requestedAt: (data.requestedAt as Timestamp) ?? null,
    completedAt: (data.completedAt as Timestamp) ?? null,
    cancelledAt: (data.cancelledAt as Timestamp) ?? null,
    driver,
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
    const trips = snap.docs.map((d) => mapDocToTripHistoryItem(d.id, d.data()));

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
    const driverPublic = isDriverPublicSnapshot(data.driverPublic) ? data.driverPublic : null;
    const historicalDriver = data.driver && typeof data.driver === 'object' ? data.driver : null;
    return {
      id: snap.id,
      mode: data.mode ?? 'solo',
      status: data.status,
      passengerId: data.passengerId,
      driverId: data.driverId ?? null,
      pickup: data.pickup,
      destination: data.destination,
      passengerCount: data.passengerCount,
      billedSeats: data.billedSeats,
      geohash: data.geohash,
      requestedAt: (data.requestedAt as Timestamp) ?? null,
      acceptedAt: (data.acceptedAt as Timestamp) ?? null,
      completedAt: (data.completedAt as Timestamp) ?? null,
      cancelledAt: (data.cancelledAt as Timestamp) ?? null,
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
      passenger: data.passenger
        ? {
            displayName: data.passenger.displayName ?? 'Passenger',
            phone: data.passenger.phone ?? '',
          }
        : null,
    };
  } catch (err) {
    logger.error('[trip-history] getTrip failed', { err, tripId });
    throw translateFirebaseError(err);
  }
}
