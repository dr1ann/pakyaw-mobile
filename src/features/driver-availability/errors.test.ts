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
});
