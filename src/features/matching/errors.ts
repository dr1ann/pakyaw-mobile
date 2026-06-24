/**
 * Domain errors for the driver matching feature (Phase 7).
 *
 * Services translate raw platform errors into these before surfacing to
 * hooks/UI. Raw Firebase error codes must never reach the UI.
 */

/**
 * Thrown by the accept transaction when the trip is no longer claimable —
 * status moved off 'request' or another driver already set driverId.
 *
 * UI MUST handle this silently (no toast, no alert): the card is simply
 * removed from the local incoming list.
 */
export class TripAlreadyTakenError extends Error {
  readonly kind = 'TripAlreadyTakenError' as const;
  constructor() {
    super('Trip already taken.');
    this.name = 'TripAlreadyTakenError';
  }
}

/**
 * Thrown when the accept transaction fails for any reason other than the
 * trip already being taken (network, permission-denied, internal).
 */
export class AcceptTripError extends Error {
  readonly kind = 'AcceptTripError' as const;
  constructor(cause?: unknown) {
    super('Could not accept the trip. Please try again.');
    this.name = 'AcceptTripError';
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}

export type MatchingError = TripAlreadyTakenError | AcceptTripError;
