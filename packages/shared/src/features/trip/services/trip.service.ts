/**
 * trip.service — server-authoritative trip lifecycle operations.
 *
 * Firestore data is untrusted at this boundary. Trip documents are parsed by
 * the shared current/legacy reader before they reach stores or screens.
 */

import {
  doc,
  firestore,
  functions,
  httpsCallable,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type FirestoreError,
  type Unsubscribe,
} from '@/services/firebase/firebase';
import {
  CancelNotAllowedError,
  IllegalTransitionError,
  TripNotFoundError,
  TripServiceError,
} from '@pakyaw/shared/features/trip/errors';
import type { TripDoc, TripStatus } from '@pakyaw/shared/features/trip/types';
import { parseTripDocument } from '@pakyaw/shared/features/trip/read';
import { logger } from '@pakyaw/shared/lib/logger';

type CallableResult = { readonly result: 'ok' | 'invalid_transition' | 'cannot_cancel' };

function readTrip(id: string, value: unknown): TripDoc | null {
  return parseTripDocument(id, value)?.trip ?? null;
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
      if (!snap.exists()) {
        onSnap(undefined);
        return;
      }
      const trip = readTrip(snap.id, snap.data());
      if (!trip) {
        logger.error('[trip] rejected malformed trip document', { tripId });
        onSnap(undefined);
        return;
      }
      onSnap(trip);
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
    if (result.data.result !== 'ok') throw new IllegalTransitionError('requested', next);

    logger.info('[trip] transition success', { tripId, next });
  } catch (err) {
    if (err instanceof IllegalTransitionError || err instanceof TripNotFoundError) throw err;
    logger.error('[trip] transition failed', { err, tripId, next });
    throw new TripServiceError('Transition failed', err);
  }
}

export async function cancel(
  tripId: string,
  actorId: string,
  reason: string,
): Promise<void> {
  try {
    const result = await httpsCallable<
      { readonly tripId: string; readonly actorId: string; readonly reason: string },
      CallableResult
    >(functions, 'cancelTrip')({ tripId, actorId, reason });
    if (result.data.result !== 'ok') throw new CancelNotAllowedError('requested');

    logger.info('[trip] cancel processed', { tripId, reason });
  } catch (err) {
    if (err instanceof CancelNotAllowedError || err instanceof TripNotFoundError) throw err;
    logger.error('[trip] cancel failed', { err, tripId, reason });
    throw new TripServiceError('Cancel failed', err);
  }
}

export async function publishTripProgress(
  tripId: string,
  progress: { readonly remainingMeters: number; readonly etaSeconds: number },
): Promise<void> {
  const remainingMeters = Math.max(0, Math.round(progress.remainingMeters));
  const etaSeconds = Math.max(0, Math.round(progress.etaSeconds));
  if (!Number.isFinite(remainingMeters) || !Number.isFinite(etaSeconds)) return;

  try {
    await updateDoc(doc(firestore, 'trips', tripId), {
      tripProgress: { remainingMeters, etaSeconds, updatedAt: serverTimestamp() },
    });
  } catch (err) {
    logger.error('[trip] progress publish failed', { err, tripId });
    throw new TripServiceError('Progress publish failed', err);
  }
}
