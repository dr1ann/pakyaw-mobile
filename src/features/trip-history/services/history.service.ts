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
} from '@/features/trip-history/errors';
import type { HistoryCursor, TripDetail, TripHistoryItem } from '@/features/trip-history/types';
import { logger } from '@/lib/logger';
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
    driver: data.driver
      ? {
          displayName: (data.driver.displayName as string) ?? 'Driver',
          plate: (data.driver.plate as string) ?? '—',
        }
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
      driver: data.driver
        ? {
            displayName: data.driver.displayName ?? 'Driver',
            phone: data.driver.phone ?? '',
            rating: data.driver.rating ?? 5.0,
            tripCount: data.driver.tripCount ?? 0,
            plate: data.driver.plate ?? '—',
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
