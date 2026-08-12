import type {
  CancelDecision,
  CancelReason,
  TripAction,
  TripActor,
  TripStatus,
  TripTransitionResult,
} from './types';

export const CANCEL_REASONS: readonly CancelReason[] = [
  'passenger_changed_mind',
  'driver_unavailable',
  'unable_to_locate_passenger',
  'vehicle_issue',
  'safety_concern',
  'other',
] as const;

const FORWARD_TRANSITIONS: Readonly<Record<TripStatus, readonly TripStatus[]>> = {
  requested: ['accepted'],
  accepted: ['driver_arriving'],
  driver_arriving: ['driver_arrived'],
  driver_arrived: ['in_progress'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};

const CANCELLABLE_STATUSES_BY_ACTOR: Readonly<
  Record<TripActor, readonly TripStatus[]>
> = {
  passenger: ['requested', 'accepted', 'driver_arriving', 'driver_arrived'],
  driver: ['accepted', 'driver_arriving', 'driver_arrived'],
  admin: [],
};

function isCancelReason(reason: string | undefined): reason is CancelReason {
  return (
    reason !== undefined &&
    (CANCEL_REASONS as readonly string[]).includes(reason)
  );
}

/**
 * A trip may be cancelled before it starts. Once it is in progress, the
 * safety flow should create an incident rather than silently changing the trip
 * lifecycle; completed and cancelled trips are terminal.
 */
export function canCancel(
  tripStatus: TripStatus,
  actor: TripActor,
): CancelDecision {
  return {
    allowed: CANCELLABLE_STATUSES_BY_ACTOR[actor].includes(tripStatus),
    requiredReason: true,
  };
}

export function getCancelReasons(
  tripStatus: TripStatus,
  actor: TripActor,
): readonly CancelReason[] {
  return canCancel(tripStatus, actor).allowed ? CANCEL_REASONS : [];
}

/**
 * Validates the lifecycle transition only. The Cloud Function remains the
 * authority for actor identity, offer ownership, and atomic writes.
 */
export function tripTransition(
  current: TripStatus,
  action: TripAction,
  actor: TripActor,
): TripTransitionResult {
  if (action.type === 'cancel') {
    const cancellation = canCancel(current, actor);
    if (!cancellation.allowed) {
      return { allowed: false, error: 'cannot_cancel' };
    }

    if (!isCancelReason(action.reason)) {
      return { allowed: false, error: 'invalid_cancel_reason' };
    }

    return { allowed: true, next: 'cancelled' };
  }

  if (!FORWARD_TRANSITIONS[current].includes(action.next)) {
    return { allowed: false, error: 'invalid_transition' };
  }

  if (actor !== 'driver') {
    return { allowed: false, error: 'unauthorized_actor' };
  }

  return { allowed: true, next: action.next };
}
