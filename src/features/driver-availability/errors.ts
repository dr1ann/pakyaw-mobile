import { FirebaseError } from 'firebase/app';

/**
 * Domain errors for the driver-availability feature.
 *
 * LocationPermissionError is a first-class state per architecture §10.7.
 * Services translate raw platform errors into these before surfacing to hooks/UI.
 */

/**
 * Thrown when the user denies or revokes foreground location permission.
 * Surfaces in useLocationPublisher as a first-class error state.
 * The driver remains offline; no automatic retry.
 */
export class LocationPermissionError extends Error {
  readonly kind = 'LocationPermissionError' as const;
  constructor(
    message = 'Location permission is required to go online. Please grant it in Settings.',
  ) {
    super(message);
    this.name = 'LocationPermissionError';
  }
}

/**
 * Thrown when the driver tries to go online but the preflight has not been passed.
 */
export class PreflightNotPassedError extends Error {
  readonly kind = 'PreflightNotPassedError' as const;
  constructor(
    message = 'Please complete the pre-flight checklist before going online.',
  ) {
    super(message);
    this.name = 'PreflightNotPassedError';
  }
}

/**
 * Thrown when a Firestore write to drivers/{uid} fails.
 */
export class PresenceWriteError extends Error {
  readonly kind = 'PresenceWriteError' as const;
  constructor(cause?: unknown) {
    super('Failed to update availability. Please try again.');
    this.name = 'PresenceWriteError';
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}

/**
 * The server permits a driver to become available only after the canonical
 * approval and required-document checks have passed. Do not expose a raw
 * Firestore permission error for this expected product state.
 */
export class DriverAccountNotReadyError extends Error {
  readonly kind = 'DriverAccountNotReadyError' as const;
  constructor() {
    super(
      'Your driver account is still being verified. You can go online once verification is complete.',
    );
    this.name = 'DriverAccountNotReadyError';
  }
}

/** Maps infrastructure errors to product-safe availability errors. */
export function translatePresenceWriteError(cause: unknown): DriverAvailabilityError {
  if (cause instanceof FirebaseError && (
    cause.code === 'permission-denied'
    || cause.code === 'functions/permission-denied'
    || ((cause.code === 'failed-precondition' || cause.code === 'functions/failed-precondition')
      && cause.message.toLowerCase().includes('account is not ready'))
  )) {
    return new DriverAccountNotReadyError();
  }
  return new PresenceWriteError(cause);
}

export type DriverAvailabilityError =
  | LocationPermissionError
  | PreflightNotPassedError
  | DriverAccountNotReadyError
  | PresenceWriteError;
