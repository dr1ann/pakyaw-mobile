/**
 * trip.service — Phase 8A/8B trip lifecycle state machine.
 *
 * - subscribe: real-time listener on a single trip document, mapped to TripDoc.
 * - transition: forward-only status change within a Firestore transaction.
 * - cancel: move trip to 'cancelled' with metadata, reset driver state.
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

    logger.info('[trip] cancelled', { tripId, by, reason });
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
