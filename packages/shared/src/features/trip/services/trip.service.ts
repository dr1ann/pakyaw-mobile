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

import {
  doc,
  firestore,
  functions,
  httpsCallable,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  FirebaseError,
  type DocumentData,
  type FirestoreError,
  type Timestamp,
  type Unsubscribe,
} from '@/services/firebase/firebase';
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
import { isDriverPublicSnapshot, isRideMode, isTripStatus, type FareBreakdown, type SharedRideSummary } from '@pakyaw/shared/transport/contract';

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

type CanonicalTripData = DocumentData & {
  readonly mode: TripDoc['mode'];
  readonly status: TripDoc['status'];
  readonly passengerId: string;
  readonly driverId: string | null;
  readonly pickup: { readonly latitude: number; readonly longitude: number; readonly label?: string };
  readonly destination: { readonly latitude: number; readonly longitude: number; readonly label?: string };
  readonly passengerCount: number;
  readonly billedSeats: number;
  readonly fare: FareBreakdown;
  readonly route: {
    readonly distanceMeters: number;
    readonly durationSeconds: number;
    readonly polyline?: string;
    readonly fetchedAt?: Timestamp | null;
  };
  readonly sharedRideId?: string | null;
  readonly sharedRideSummary?: SharedRideSummary | null;
};

function isCanonicalPlace(value: unknown): value is CanonicalTripData['pickup'] {
  if (value === null || typeof value !== 'object') return false;
  const place = value as Record<string, unknown>;
  return typeof place.latitude === 'number'
    && Number.isFinite(place.latitude)
    && typeof place.longitude === 'number'
    && Number.isFinite(place.longitude)
    && (place.label === undefined || typeof place.label === 'string');
}

function isCanonicalRoute(value: unknown): value is CanonicalTripData['route'] {
  if (value === null || typeof value !== 'object') return false;
  const route = value as Record<string, unknown>;
  return typeof route.distanceMeters === 'number'
    && Number.isFinite(route.distanceMeters)
    && route.distanceMeters >= 0
    && typeof route.durationSeconds === 'number'
    && Number.isFinite(route.durationSeconds)
    && route.durationSeconds >= 0
    && (route.polyline === undefined || typeof route.polyline === 'string');
}

function isCanonicalFareBreakdown(value: unknown): value is FareBreakdown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const fare = value as Record<string, unknown>;
  const hasValidSurcharges =
    (typeof fare.surcharges === 'number' && Number.isFinite(fare.surcharges) && fare.surcharges >= 0) ||
    (fare.surcharges !== null && typeof fare.surcharges === 'object' && typeof (fare.surcharges as any).total === 'number');
  return ['baseFare', 'distanceFare', 'techFee', 'total'].every((field) => (
    typeof fare[field] === 'number' && Number.isFinite(fare[field]) && (fare[field] as number) >= 0
  )) && hasValidSurcharges && (fare.driverEarnings === undefined
    || (typeof fare.driverEarnings === 'number' && Number.isFinite(fare.driverEarnings) && fare.driverEarnings >= 0));
}

function isSharedRideSummary(value: unknown): value is SharedRideSummary {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const summary = value as Record<string, unknown>;
  return typeof summary.seatsOccupied === 'number'
    && Number.isInteger(summary.seatsOccupied)
    && summary.seatsOccupied >= 0
    && typeof summary.maxSeats === 'number'
    && Number.isInteger(summary.maxSeats)
    && summary.maxSeats >= 1
    && summary.seatsOccupied <= summary.maxSeats
    && typeof summary.passengerGroups === 'number'
    && Number.isInteger(summary.passengerGroups)
    && summary.passengerGroups >= 0;
}

function isCanonicalTripData(data: DocumentData): data is CanonicalTripData {
  return isRideMode(data.mode)
    && isTripStatus(data.status)
    && typeof data.passengerId === 'string'
    && (data.driverId === null || typeof data.driverId === 'string')
    && isCanonicalPlace(data.pickup)
    && isCanonicalPlace(data.destination)
    && Number.isInteger(data.passengerCount)
    && data.passengerCount >= 1
    && Number.isInteger(data.billedSeats)
    && data.billedSeats >= 1
    && isCanonicalFareBreakdown(data.fare)
    && isCanonicalRoute(data.route);
}

function mapCanonicalTripDoc(id: string, data: CanonicalTripData): TripDoc {
  return {
    id,
    mode: data.mode,
    status: data.status,
    passengerId: data.passengerId,
    driverId: data.driverId,
    driverPublic: isDriverPublicSnapshot(data.driverPublic) ? data.driverPublic : null,
    sharedRideId: typeof data.sharedRideId === 'string' ? data.sharedRideId : null,
    sharedRideSummary: isSharedRideSummary(data.sharedRideSummary) ? data.sharedRideSummary : null,
    pickup: safePlace(data.pickup),
    destination: safePlace(data.destination),
    passengerCount: data.passengerCount,
    billedSeats: data.billedSeats,
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
    // `fare` is retained as a derived display projection for existing UI;
    // fareBreakdown is the canonical server-owned representation.
    fare: typeof data.fare?.total === 'number' && Number.isFinite(data.fare.total)
      ? data.fare.total
      : typeof data.fare === 'number' && Number.isFinite(data.fare)
        ? data.fare
        : 0,
    fareBreakdown: {
      ...data.fare,
      surcharges: typeof (data.fare as any).surcharges === 'number'
        ? (data.fare as any).surcharges
        : ((data.fare as any).surcharges?.total ?? 0),
    },
    route: {
      distanceMeters: data.route.distanceMeters,
      durationSeconds: data.route.durationSeconds,
      polyline: data.route.polyline ?? '',
      fetchedAt: data.route.fetchedAt ?? null,
    },
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

/**
 * Compatibility reader for genuinely historical Trip documents. Defaults
 * stay here, outside the canonical path, so current server-owned documents
 * cannot silently lose or invent contract fields.
 */
function mapLegacyTripDoc(id: string, data: DocumentData): TripDoc {
  const passengerCount = typeof data.passengerCount === 'number' ? data.passengerCount : 1;
  return {
    id,
    mode: isRideMode(data.mode) ? data.mode : 'solo',
    status: isTripStatus(data.status) ? data.status : 'requested',
    passengerId: data.passengerId as string,
    driverId: (data.driverId as string) ?? null,
    driverPublic: isDriverPublicSnapshot(data.driverPublic) ? data.driverPublic : null,
    sharedRideId: typeof data.sharedRideId === 'string' ? data.sharedRideId : null,
    sharedRideSummary: isSharedRideSummary(data.sharedRideSummary) ? data.sharedRideSummary : null,
    pickup: safePlace(data.pickup),
    destination: safePlace(data.destination),
    passengerCount,
    billedSeats: typeof data.billedSeats === 'number' ? data.billedSeats : passengerCount,
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
    fare: typeof data.fare === 'number' && Number.isFinite(data.fare)
      ? data.fare
      : typeof (data.fare as any)?.total === 'number' && Number.isFinite((data.fare as any).total)
        ? (data.fare as any).total
        : typeof (data.fareBreakdown as any)?.total === 'number' && Number.isFinite((data.fareBreakdown as any).total)
          ? (data.fareBreakdown as any).total
          : undefined,
    fareBreakdown: isCanonicalFareBreakdown(data.fare)
      ? {
          ...data.fare,
          surcharges: typeof (data.fare as any).surcharges === 'number'
            ? (data.fare as any).surcharges
            : ((data.fare as any).surcharges?.total ?? 0),
        }
      : isCanonicalFareBreakdown(data.fareBreakdown)
        ? {
            ...data.fareBreakdown,
            surcharges: typeof (data.fareBreakdown as any).surcharges === 'number'
              ? (data.fareBreakdown as any).surcharges
              : ((data.fareBreakdown as any).surcharges?.total ?? 0),
          }
        : undefined,
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

function mapDocToTripDoc(id: string, data: DocumentData): TripDoc {
  return isCanonicalTripData(data)
    ? mapCanonicalTripDoc(id, data)
    : mapLegacyTripDoc(id, data);
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
  const remainingMeters = Math.max(0, Math.round(progress.remainingMeters));
  const etaSeconds = Math.max(0, Math.round(progress.etaSeconds));

  if (!Number.isFinite(remainingMeters) || !Number.isFinite(etaSeconds)) {
    return;
  }

  const tripRef = doc(firestore, 'trips', tripId);

  try {
    await updateDoc(tripRef, {
      tripProgress: {
        remainingMeters,
        etaSeconds,
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
