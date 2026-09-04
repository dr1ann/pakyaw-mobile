import { FirebaseError } from '@/services/firebase/firebase';
import { describe, expect, it } from 'vitest';

import {
  DriverAccountNotReadyError,
  LocationPermissionError,
  PreflightNotPassedError,
  PresenceWriteError,
  publicEligibilityMessage,
  translatePresenceWriteError,
  type DriverEligibilityBlockedReason,
} from '@/features/driver-availability/errors';

describe('translatePresenceWriteError', () => {
  it('maps a Firestore permission rejection to a safe account-verification error', () => {
    const error = translatePresenceWriteError(
      new FirebaseError('permission-denied', 'Missing or insufficient permissions.'),
    );

    expect(error).toBeInstanceOf(DriverAccountNotReadyError);
    expect(error.message).not.toMatch(/permission|firestore/i);
    expect((error as DriverAccountNotReadyError).reason).toBe('verification_required');
  });

  it('keeps transient failures as a retryable availability error', () => {
    const error = translatePresenceWriteError(new Error('network unavailable'));

    expect(error).toBeInstanceOf(PresenceWriteError);
    expect(error.message).toBe('Failed to update availability. Please try again.');
  });

  it.each([
    ['already_on_trip', 'You still have an active trip.'],
    ['application_not_approved', 'Your Driver application is still under review.'],
    ['account_suspended', 'Your Driver account is suspended.'],
    ['account_blocked', 'Your Driver account is unavailable.'],
    ['documents_incomplete', 'Complete and submit all required Driver documents'],
    ['documents_expired', 'A required Driver document has expired.'],
    ['vehicle_type_inactive', 'Your selected Vehicle Type is inactive.'],
    ['vehicle_identity_invalid', 'Complete the vehicle identity details'],
    ['stale_location', 'Your location is outdated.'],
    ['outside_service_area', 'You’re outside Pakyaw’s current service area.'],
    ['poor_gps_accuracy', 'GPS signal is weak.'],
    ['verification_required', 'Complete Driver verification before going online.'],
  ] as const)('maps %s to a product-safe explanation', (reason, expectedMessage) => {
    const error = translatePresenceWriteError(
      new FirebaseError('failed-precondition', `Cannot go online: ${reason}.`),
    );

    expect(error).toBeInstanceOf(DriverAccountNotReadyError);
    expect(error).toMatchObject({ reason });
    expect(error.message).toContain(expectedMessage);
    expect(error.message).not.toMatch(/firestore|failed-precondition|Cannot go online/i);
  });

  it('maps details field if reason is embedded in callable details', () => {
    const error = translatePresenceWriteError({
      code: 'functions/failed-precondition',
      message: 'Precondition failed',
      details: 'Cannot go online: stale_location',
    });

    expect(error).toBeInstanceOf(DriverAccountNotReadyError);
    expect((error as DriverAccountNotReadyError).reason).toBe('stale_location');
  });
});

describe('Domain Errors constructors', () => {
  it('LocationPermissionError has expected message and name', () => {
    const err = new LocationPermissionError();
    expect(err.name).toBe('LocationPermissionError');
    expect(err.kind).toBe('LocationPermissionError');
    expect(err.message).toContain('Location access is required');
  });

  it('PreflightNotPassedError has expected message and name', () => {
    const err = new PreflightNotPassedError();
    expect(err.name).toBe('PreflightNotPassedError');
    expect(err.kind).toBe('PreflightNotPassedError');
    expect(err.message).toContain('pre-flight checklist');
  });

  it('publicEligibilityMessage covers all reasons without throwing', () => {
    const allReasons: DriverEligibilityBlockedReason[] = [
      'already_on_trip',
      'application_not_approved',
      'account_suspended',
      'account_blocked',
      'documents_incomplete',
      'documents_expired',
      'vehicle_type_inactive',
      'vehicle_identity_invalid',
      'stale_location',
      'outside_service_area',
      'poor_gps_accuracy',
      'verification_required',
    ];

    for (const reason of allReasons) {
      const msg = publicEligibilityMessage(reason);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(10);
    }
  });
});
