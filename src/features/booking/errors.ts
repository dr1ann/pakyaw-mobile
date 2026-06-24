/**
 * Domain errors for the passenger booking feature (Phase 6).
 *
 * Services translate raw platform errors into these before surfacing to
 * hooks/UI. Raw Firebase error codes must never reach the UI.
 */

/**
 * Thrown when the trip create write fails due to network connectivity.
 * UI copy is intentionally short and actionable (no queueing, no retry).
 */
export class BookingOfflineError extends Error {
  readonly kind = 'BookingOfflineError' as const;
  constructor(message = 'Offline — try again when connected.') {
    super(message);
    this.name = 'BookingOfflineError';
  }
}

/**
 * Thrown when the trip create write fails for a non-network reason.
 */
export class BookingWriteError extends Error {
  readonly kind = 'BookingWriteError' as const;
  constructor(cause?: unknown) {
    super('Could not create your trip. Please try again.');
    this.name = 'BookingWriteError';
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}

export type BookingError = BookingOfflineError | BookingWriteError;
