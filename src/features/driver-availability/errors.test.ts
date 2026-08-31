import { FirebaseError } from 'firebase/app';
import { describe, expect, it } from 'vitest';

import {
  DriverAccountNotReadyError,
  PresenceWriteError,
  translatePresenceWriteError,
} from '@/features/driver-availability/errors';

describe('translatePresenceWriteError', () => {
  it('maps a Firestore permission rejection to a safe account-verification error', () => {
    const error = translatePresenceWriteError(
      new FirebaseError('permission-denied', 'Missing or insufficient permissions.'),
    );

    expect(error).toBeInstanceOf(DriverAccountNotReadyError);
    expect(error.message).not.toMatch(/permission|firestore/i);
  });

  it('keeps transient failures as a retryable availability error', () => {
    const error = translatePresenceWriteError(new Error('network unavailable'));

    expect(error).toBeInstanceOf(PresenceWriteError);
    expect(error.message).toBe('Failed to update availability. Please try again.');
  });

  it.each([
    ['application_not_approved', 'Your Driver application is still under review.'],
    ['documents_expired', 'A required Driver document has expired.'],
    ['account_suspended', 'Your Driver account is suspended.'],
  ] as const)('maps %s to a product-safe explanation', (reason, expectedMessage) => {
    const error = translatePresenceWriteError(
      new FirebaseError('failed-precondition', `Cannot go online: ${reason}.`),
    );

    expect(error).toBeInstanceOf(DriverAccountNotReadyError);
    expect(error).toMatchObject({ reason });
    expect(error.message).toContain(expectedMessage);
    expect(error.message).not.toMatch(/firestore|failed-precondition|Cannot go online/i);
  });

  it('does not misclassify an active-trip restriction as verification failure', () => {
    const error = translatePresenceWriteError(
      new FirebaseError('failed-precondition', 'Cannot go online: already_on_trip.'),
    );

    expect(error).toBeInstanceOf(PresenceWriteError);
  });
});
