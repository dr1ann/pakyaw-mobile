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
} from '@/services/firebase/firebase';

import {
  NetworkError,
  NotFoundError,
  PermissionError,
  QueryIndexError,
  TripHistoryServiceError,
} from '@pakyaw/shared/features/trip-history/errors';
import type { HistoryCursor, TripDetail, TripHistoryItem } from '@pakyaw/shared/features/trip-history/types';
import { parseTripDocument } from '@pakyaw/shared/features/trip/read';
import { logger } from '@pakyaw/shared/lib/logger';

type RawTripSnapshot = { readonly id: string; data(): DocumentData };

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
        return new QueryIndexError();
      default:
        return new TripHistoryServiceError('Trip history is temporarily unavailable.', err);
    }
  }
  if (err instanceof Error) return err;
  return new TripHistoryServiceError('An unexpected error occurred.', err);
}

function mapDocToTripHistoryItem(id: string, data: DocumentData): TripHistoryItem | null {
  const parsed = parseTripDocument(id, data);
  if (!parsed) {
    logger.warn('[trip-history] rejected malformed trip document', { tripId: id });
    return null;
  }

  const { trip, historyMode, driver } = parsed;
  return {
    tripId: id,
    status: trip.status,
    mode: historyMode,
    fare: typeof trip.fare === 'number' ? trip.fare : null,
    distanceMeters: trip.route?.distanceMeters ?? null,
    pickup: { label: trip.pickup.label },
    destination: { label: trip.destination.label },
    passengerCount: trip.passengerCount,
    requestedAt: trip.requestedAt,
    completedAt: trip.completedAt,
    cancelledAt: trip.cancelledAt,
    driver,
    bookingFor: trip.bookingFor,
    rider: trip.rider,
    cancelledBy: trip.cancelledBy,
    cancelReason: trip.cancelReason,
  };
}

function mapHistoryDocs(docs: readonly RawTripSnapshot[]): TripHistoryItem[] {
  return docs.flatMap((snapshot) => {
    const mapped = mapDocToTripHistoryItem(snapshot.id, snapshot.data());
    return mapped ? [mapped] : [];
  });
}

function cursorFromItem(item: TripHistoryItem | undefined): HistoryCursor | null {
  const timestamp = item?.requestedAt;
  return timestamp
    ? { seconds: timestamp.seconds, nanoseconds: timestamp.nanoseconds }
    : null;
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
      q = query(q, startAfter(new Timestamp(options.cursor.seconds, options.cursor.nanoseconds)));
    }

    const snap = await getDocs(q);
    const trips = mapHistoryDocs(snap.docs as readonly RawTripSnapshot[]);
    const lastTrip = trips[trips.length - 1];
    return {
      trips,
      nextCursor: snap.docs.length === options.limit ? cursorFromItem(lastTrip) : null,
    };
  } catch (err) {
    logger.error('[trip-history] listForPassenger failed', { err, uid });
    throw translateFirebaseError(err);
  }
}

export async function getTrip(tripId: string): Promise<TripDetail> {
  try {
    const snap = await getDoc(doc(firestore, 'trips', tripId));
    if (!snap.exists()) throw new NotFoundError();

    const parsed = parseTripDocument(snap.id, snap.data());
    if (!parsed) {
      logger.error('[trip-history] rejected malformed trip document', { tripId });
      throw new TripHistoryServiceError('The requested trip data is unavailable.');
    }

    return {
      ...parsed.trip,
      mode: parsed.historyMode,
      driver: parsed.driver,
      passenger: null,
    };
  } catch (err) {
    logger.error('[trip-history] getTrip failed', { err, tripId });
    throw translateFirebaseError(err);
  }
}
