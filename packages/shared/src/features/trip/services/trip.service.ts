/**
 * trip.service — Phase 8A/8B trip lifecycle state machine.
 *
 * - subscribe: real-time listener on a single trip document, mapped to TripDoc.
 * - transition: server-authoritative forward lifecycle callable.
 * - cancel: server-authoritative cancellation callable. A requested
 *   cancellation is retained as `cancelled`, preserving audit/history data.
 *
 * The request → accepted transition belongs exclusively to Phase 7
 * acceptTrip() and is intentionally rejected here.
 */

import { FirebaseError } from 'firebase/app';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type FirestoreError,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import {
  CancelNotAllowedError,
  IllegalTransitionError,
  TripNotFoundError,
  TripServiceError,
} from '@pakyaw/shared/features/trip/errors';
import {
  type CancelReason,
  type CancelledBy,
  type TripDoc,
  type TripStatus,
} from '@pakyaw/shared/features/trip/types';
import { logger } from '@pakyaw/shared/lib/logger';
import { firestore, functions } from '@/services/firebase/firebase';

type CallableResult = { readonly result: 'ok' | 'invalid_transition' | 'cannot_cancel' };

function safePlace(value: unknown): TripDoc['pickup'] {
  if (value !== null && typeof value === 'object') {
    const location = value as Record<string, unknown>;
    if (typeof location.latitude === 'number' && typeof location.longitude === 'number') {
      return {
        label: typeof location.label === 'string' ? location.label : 'Location',
        coords: { lat: location.latitude, lng: location.longitude },
      };
    }
  }
  return { label: 'Location', coords: null };
}

function mapDocToTripDoc(id: string, data: DocumentData): TripDoc {
  return {
    id,
    mode: data.mode === 'shared' || data.mode === 'hop' ? data.mode : 'solo',
    status: data.status as TripStatus,
    passengerId: data.passengerId as string,
    driverId: (data.driverId as string) ?? null,
    pickup: safePlace(data.pickup),
    destination: safePlace(data.destination),
    passengerCount: typeof data.passengerCount === 'number' ? data.passengerCount : 1,
    billedSeats: typeof data.billedSeats === 'number'
      ? data.billedSeats
      : (typeof data.passengerCount === 'number' ? data.passengerCount : 1),
    geohash: typeof data.geohash === 'string' ? data.geohash : '',
    requestedAt: (data.requestedAt as Timestamp) ?? null,
    acceptedAt: (data.acceptedAt as Timestamp) ?? null,
    completedAt: (data.completedAt as Timestamp) ?? null,
    cancelledAt: (data.cancelledAt as Timestamp) ?? null,
    cancelledBy: (data.cancelledBy as CancelledBy) ?? null,
    cancelReason: (data.cancelReason as string) ?? null,
    matching: data.matching && typeof data.matching === 'object'
      && ['initial', 'second', 'final', 'timed_out'].includes(data.matching.stage)
      ? {
        stage: data.matching.stage as 'initial' | 'second' | 'final' | 'timed_out',
        radiusKm: typeof data.matching.radiusKm === 'number' ? data.matching.radiusKm : undefined,
      }
      : null,
    fare: data.fare as number | undefined,
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
      logger.error('[trip] subscribe failed', { err, tripId });
      onErr(err);
    },
  );
}

export async function transition(
  tripId: string,
  actorId: string,
  next: TripStatus,
): Promise<void> {
  if (next === 'requested' || next === 'accepted') {
    throw new IllegalTransitionError('requested', next);
  }

  try {
    const result = await httpsCallable<
      { readonly tripId: string; readonly transition: TripStatus; readonly actorId: string },
      CallableResult
    >(functions, 'transitionTrip')({ tripId, transition: next, actorId });
    if (result.data.result !== 'ok') {
      throw new IllegalTransitionError('requested', next);
    }

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
  actorId: string,
  reason: CancelReason,
): Promise<void> {
  try {
    const result = await httpsCallable<
      { readonly tripId: string; readonly actorId: string; readonly reason: CancelReason },
      CallableResult
    >(functions, 'cancelTrip')({ tripId, actorId, reason });
    if (result.data.result !== 'ok') {
      throw new CancelNotAllowedError('requested');
    }

    logger.info('[trip] cancel processed', { tripId, reason });
  } catch (err) {
    if (
      err instanceof CancelNotAllowedError ||
      err instanceof TripNotFoundError
    ) {
      throw err;
    }
    logger.error('[trip] cancel failed', { err, tripId, reason });
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
