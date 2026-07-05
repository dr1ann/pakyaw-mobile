/**
 * Phase 8A — Trip lifecycle domain errors.
 *
 * Services translate raw platform errors into these before surfacing to
 * hooks/UI. Raw Firebase error codes must never reach the UI.
 */

import type { TripStatus } from '@pakyaw/shared/features/trip/types';

/**
 * Thrown when a transition is attempted that violates the forward-only
 * state machine (e.g. accepted → completed, or from a terminal state).
 */
export class IllegalTransitionError extends Error {
  readonly kind = 'IllegalTransitionError' as const;
  readonly from: TripStatus;
  readonly to: TripStatus;

  constructor(from: TripStatus, to: TripStatus) {
    super(`Illegal transition: ${from} → ${to}`);
    this.name = 'IllegalTransitionError';
    this.from = from;
    this.to = to;
  }
}

/**
 * Thrown when a cancel is attempted on a trip that cannot be cancelled
 * (terminal state or in_progress).
 */
export class CancelNotAllowedError extends Error {
  readonly kind = 'CancelNotAllowedError' as const;
  readonly currentStatus: TripStatus;

  constructor(currentStatus: TripStatus) {
    super(`Cannot cancel trip in status: ${currentStatus}`);
    this.name = 'CancelNotAllowedError';
    this.currentStatus = currentStatus;
  }
}

/**
 * Thrown when a trip document is not found during a transition.
 */
export class TripNotFoundError extends Error {
  readonly kind = 'TripNotFoundError' as const;
  constructor(tripId: string) {
    super(`Trip not found: ${tripId}`);
    this.name = 'TripNotFoundError';
  }
}

/**
 * Thrown when an unexpected Firebase error occurs during a trip operation.
 */
export class TripServiceError extends Error {
  readonly kind = 'TripServiceError' as const;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'TripServiceError';
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}

export type TripError =
  | IllegalTransitionError
  | CancelNotAllowedError
  | TripNotFoundError
  | TripServiceError;
