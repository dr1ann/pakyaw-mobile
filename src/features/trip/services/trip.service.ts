/**
 * trip.service — Phase 8A/8B trip lifecycle state machine.
 *
 * - subscribe: real-time listener on a single trip document, mapped to TripDoc.
 * - transition: forward-only status change within a Firestore transaction.
 * - cancel: lifecycle-dependent cancellation within a Firestore transaction.
 *     - Before driver acceptance (status 'request'): the document is permanently
 *       DELETED. No 'cancelled' status is written, no history is kept — this is
 *       an abandoned booking request. Driver listeners observe a Firestore
 *       document-removal event.
 *     - After driver acceptance (status 'accepted' | 'driver_arriving' |
 *       'driver_arrived'): the document is retained, status moves to 'cancelled'
 *       with metadata, and driver availability is restored.
 *     - During the ride (status 'in_progress') and terminal states: rejected.
 *
 * The request → accepted transition belongs exclusively to Phase 7
 * acceptTrip() and is intentionally rejected here.
 */

import { FirebaseError } from 'firebase/app';
import {
  doc,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type FirestoreError,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import {
  CancelNotAllowedError,
  IllegalTransitionError,
  TripNotFoundError,
  TripServiceError,
} from '@/features/trip/errors';
import {
  ALLOWED_TRANSITIONS,
  CANCELLABLE_STATUSES,
  type CancelledBy,
  type TripDoc,
  type TripStatus,
} from '@/features/trip/types';
import { logger } from '@/lib/logger';
import { firestore } from '@/services/firebase/firebase';

function mapDocToTripDoc(id: string, data: DocumentData): TripDoc {
  return {
    id,
    mode: data.mode ?? 'solo',
    status: data.status as TripStatus,
    passengerId: data.passengerId as string,
    driverId: (data.driverId as string) ?? null,
    pickup: data.pickup,
    destination: data.destination,
    passengerCount: data.passengerCount as number,
    billedSeats: data.billedSeats as number,
    geohash: data.geohash as string,
    requestedAt: (data.requestedAt as Timestamp) ?? null,
    acceptedAt: (data.acceptedAt as Timestamp) ?? null,
    completedAt: (data.completedAt as Timestamp) ?? null,
    cancelledAt: (data.cancelledAt as Timestamp) ?? null,
    cancelledBy: (data.cancelledBy as CancelledBy) ?? null,
    cancelReason: (data.cancelReason as string) ?? null,
    route: data.route
      ? {
        distanceMeters: data.route.distanceMeters as number,
        durationSeconds: data.route.durationSeconds as number,
        polyline: data.route.polyline as string,
        fetchedAt: (data.route.fetchedAt as Timestamp) ?? null,
      }
      : null,
    driverRoute: data.driverRoute
      ? {
        polyline: data.driverRoute.polyline as string,
        distanceMeters: data.driverRoute.distanceMeters as number,
        durationSeconds: data.driverRoute.durationSeconds as number,
        updatedAt: (data.driverRoute.updatedAt as Timestamp) ?? null,
      }
      : null,
    tripProgress: data.tripProgress
      ? {
        remainingMeters: data.tripProgress.remainingMeters as number,
        etaSeconds: data.tripProgress.etaSeconds as number,
        updatedAt: (data.tripProgress.updatedAt as Timestamp) ?? null,
      }
      : null,
    serviceAreaId: (data.serviceAreaId as 'ormoc') ?? null,
  };
}

export function subscribe(
  tripId: string,
  onSnap: (trip: TripDoc | undefined) => void,
  onErr: (err: FirestoreError) => void,
): Unsubscribe {
  const tripRef = doc(firestore, 'trips', tripId);

  return onSnapshot(
    tripRef,
    (snap) => {
      if (snap.exists()) {
        onSnap(mapDocToTripDoc(snap.id, snap.data()));
      } else {
        onSnap(undefined);
      }
    },
    (err) => {
      // A passenger-initiated 'request' cancel deletes the trip document
      // (see cancel() below). Firestore re-evaluates the listener's read
      // rule against the now-missing doc and returns 'permission-denied'
      // because resource.data is null. Treat that as a normal teardown —
      // the doc is simply gone — not an error condition.
      if (err.code === 'permission-denied') {
        logger.info('[trip] subscription ended (doc removed)', { tripId });
        onSnap(undefined);
        return;
      }
      logger.error('[trip] subscribe failed', { err, tripId });
      onErr(err);
    },
  );
}

export async function transition(
  tripId: string,
  next: TripStatus,
): Promise<void> {
  if (next === 'request' || next === 'accepted') {
    throw new IllegalTransitionError('request' as TripStatus, next);
  }

  const tripRef = doc(firestore, 'trips', tripId);

  try {
    await runTransaction(firestore, async (tx) => {
      const tripSnap = await tx.get(tripRef);

      if (!tripSnap.exists()) {
        throw new TripNotFoundError(tripId);
      }

      const trip = tripSnap.data();
      const current = trip.status as TripStatus;

      if (current === 'request') {
        throw new IllegalTransitionError(current, next);
      }

      const allowed = ALLOWED_TRANSITIONS[current as Exclude<TripStatus, 'request'>];
      if (!allowed.includes(next)) {
        throw new IllegalTransitionError(current, next);
      }

      if (next === 'completed') {
        const driverId = trip.driverId as string;
        const driverRef = doc(firestore, 'drivers', driverId);

        tx.update(tripRef, {
          status: 'completed',
          completedAt: serverTimestamp(),
        });
        tx.update(driverRef, {
          activeTripId: null,
          availability: 'online',
          tripCount: increment(1),
        });
      } else {
        tx.update(tripRef, { status: next });
      }
    });

    logger.info('[trip] transition success', { tripId, next });
  } catch (err) {
    if (
      err instanceof IllegalTransitionError ||
      err instanceof TripNotFoundError
    ) {
      throw err;
    }
    logger.error('[trip] transition failed', { err, tripId, next });
    if (err instanceof FirebaseError) {
      throw new TripServiceError('Transition failed', err);
    }
    throw new TripServiceError('Transition failed', err);
  }
}

export async function cancel(
  tripId: string,
  by: CancelledBy,
  reason: string,
): Promise<void> {
  const tripRef = doc(firestore, 'trips', tripId);

  try {
    await runTransaction(firestore, async (tx) => {
      const tripSnap = await tx.get(tripRef);

      if (!tripSnap.exists()) {
        throw new TripNotFoundError(tripId);
      }

      const trip = tripSnap.data();
      const current = trip.status as TripStatus;

      if (!CANCELLABLE_STATUSES.includes(current)) {
        throw new CancelNotAllowedError(current);
      }

      // Before driver acceptance: a 'request' cancellation is an abandoned
      // booking. Delete the document outright — no 'cancelled' status is
      // written, no trip history is kept, and there is no driver to restore.
      // Driver listeners observe a Firestore document-removal event.
      if (current === 'request') {
        tx.delete(tripRef);
        return;
      }

      // After acceptance: retain the document, mark it cancelled, and restore
      // the assigned driver's availability.
      const driverId = (trip.driverId as string) || null;

      tx.update(tripRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: by,
        cancelReason: reason,
      });

      if (driverId) {
        const driverRef = doc(firestore, 'drivers', driverId);
        tx.update(driverRef, {
          activeTripId: null,
          availability: 'online',
        });
      }
    });

    logger.info('[trip] cancel processed', { tripId, by, reason });
  } catch (err) {
    if (
      err instanceof CancelNotAllowedError ||
      err instanceof TripNotFoundError
    ) {
      throw err;
    }
    logger.error('[trip] cancel failed', { err, tripId, by, reason });
    if (err instanceof FirebaseError) {
      throw new TripServiceError('Cancel failed', err);
    }
    throw new TripServiceError('Cancel failed', err);
  }
}

export async function publishTripProgress(
  tripId: string,
  progress: {
    readonly remainingMeters: number;
    readonly etaSeconds: number;
  },
): Promise<void> {
  const tripRef = doc(firestore, 'trips', tripId);

  try {
    await updateDoc(tripRef, {
      tripProgress: {
        remainingMeters: progress.remainingMeters,
        etaSeconds: progress.etaSeconds,
        updatedAt: serverTimestamp(),
      },
    });
  } catch (err) {
    logger.error('[trip] progress publish failed', { err, tripId });
    if (err instanceof FirebaseError) {
      throw new TripServiceError('Progress publish failed', err);
    }
    throw new TripServiceError('Progress publish failed', err);
  }
}
