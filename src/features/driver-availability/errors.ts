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
  readonly reason: DriverEligibilityBlockedReason;
  constructor(reason: DriverEligibilityBlockedReason = 'verification_required') {
    super(publicEligibilityMessage(reason));
    this.name = 'DriverAccountNotReadyError';
    this.reason = reason;
  }
}

export type DriverEligibilityBlockedReason =
  | 'application_not_approved'
  | 'account_suspended'
  | 'account_blocked'
  | 'documents_incomplete'
  | 'documents_expired'
  | 'verification_required';

function publicEligibilityMessage(reason: DriverEligibilityBlockedReason): string {
  switch (reason) {
    case 'application_not_approved':
      return 'Your Driver application is still under review. You can go online after Operations approval.';
    case 'account_suspended':
      return 'Your Driver account is suspended. Please contact Operations.';
    case 'account_blocked':
      return 'Your Driver account is unavailable. Please contact Operations.';
    case 'documents_incomplete':
      return 'Complete and submit all required Driver documents before going online.';
    case 'documents_expired':
      return 'A required Driver document has expired. Update it before going online.';
    case 'verification_required':
      return 'Complete Driver verification before going online.';
  }
}

function parseEligibilityReason(message: string): DriverEligibilityBlockedReason | null {
  const match = /cannot go online:\s*([a-z_]+)/i.exec(message);
  if (match === null) return null;
  const reason = match[1] as DriverEligibilityBlockedReason;
  return reason === 'application_not_approved'
    || reason === 'account_suspended'
    || reason === 'account_blocked'
    || reason === 'documents_incomplete'
    || reason === 'documents_expired'
    || reason === 'verification_required'
    ? reason
    : null;
}

/** Maps infrastructure errors to product-safe availability errors. */
export function translatePresenceWriteError(cause: unknown): DriverAvailabilityError {
  const firebaseCode = cause instanceof FirebaseError ? cause.code : null;
  const firebaseMessage = cause instanceof FirebaseError ? cause.message : '';
  const eligibilityReason = parseEligibilityReason(firebaseMessage);
  if (cause instanceof FirebaseError && (
    firebaseCode === 'permission-denied'
    || firebaseCode === 'functions/permission-denied'
    || eligibilityReason !== null
    || ((firebaseCode === 'failed-precondition' || firebaseCode === 'functions/failed-precondition')
      && firebaseMessage.toLowerCase().includes('account is not ready'))
  )) {
    const reason = eligibilityReason ?? 'verification_required';
    return new DriverAccountNotReadyError(reason);
  }
  return new PresenceWriteError(cause);
}

export type DriverAvailabilityError =
  | LocationPermissionError
  | PreflightNotPassedError
  | DriverAccountNotReadyError
  | PresenceWriteError;
