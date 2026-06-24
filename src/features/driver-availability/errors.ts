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

export type DriverAvailabilityError =
  | LocationPermissionError
  | PreflightNotPassedError
  | PresenceWriteError;
