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
  getDoc,
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
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';

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

export async function getTrip(tripId: string): Promise<TripDoc | null> {
  const tripRef = doc(firestore, 'trips', tripId);
  try {
    const snap = await getDoc(tripRef);
    if (!snap || !snap.exists()) return null;
    const trip = readTrip(snap.id, snap.data());
    if (!trip) logger.error('[trip] rejected malformed trip document', { tripId });
    return trip;
  } catch (err) {
    logger.error('[trip] getTrip failed', { err, tripId });
    throw err;
  }
}

export type ReconciliationResult =
  | { outcome: 'retained_terminal'; trip: TripDoc }
  | { outcome: 'cleared_missing' }
  | { outcome: 'cleared_driver_mismatch'; driverId: string | null }
  | { outcome: 'cleared_inconsistency'; status: TripStatus }
  | { outcome: 'retained_network_error'; error: unknown };

export async function reconcileActiveTrip(
  tripId: string,
  currentUid: string,
): Promise<ReconciliationResult> {
  try {
    const canonicalTrip = await getTrip(tripId);

    if (!canonicalTrip) {
      logger.warn('[trip] reconciliation: trip is missing or malformed; clearing local trip', { tripId });
      useActiveTripStore.getState().clearTrip();
      return { outcome: 'cleared_missing' };
    }

    if (canonicalTrip.driverId && canonicalTrip.driverId !== currentUid) {
      logger.warn('[trip] reconciliation: trip assigned to different driver; clearing local trip', {
        tripId,
        canonicalDriverId: canonicalTrip.driverId,
        currentUid,
      });
      useActiveTripStore.getState().clearTrip();
      return { outcome: 'cleared_driver_mismatch', driverId: canonicalTrip.driverId };
    }

    if (canonicalTrip.status === 'completed' || canonicalTrip.status === 'cancelled') {
      logger.info('[trip] reconciliation: canonical trip reached terminal state; updating store', {
        tripId,
        status: canonicalTrip.status,
      });
      useActiveTripStore.getState().setTrip(canonicalTrip);
      return { outcome: 'retained_terminal', trip: canonicalTrip };
    }

    logger.warn('[trip] reconciliation: backend projection inconsistency; clearing local trip', {
      tripId,
      status: canonicalTrip.status,
      driverId: canonicalTrip.driverId,
    });
    useActiveTripStore.getState().clearTrip();
    return { outcome: 'cleared_inconsistency', status: canonicalTrip.status };
  } catch (error) {
    logger.error('[trip] reconciliation: authoritative read failed; retaining presentation', {
      tripId,
      error,
    });
    return { outcome: 'retained_network_error', error };
  }
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
