/**
 * auth.service.test.ts
 *
 * Unit tests for Firebase error → domain error translation.
 * Firebase SDK calls are mocked so no real network or Firebase app is needed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateUserWithEmailAndPassword = vi.fn();
const mockSignInWithEmailAndPassword = vi.fn();
const mockSignOut = vi.fn();
const mockDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock('@/services/firebase/firebase', () => {
  class MockFirebaseError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'FirebaseError';
      this.code = code;
    }
  }

  return {
    auth: {},
    firestore: {},
    createUserWithEmailAndPassword: (...args: any[]) => mockCreateUserWithEmailAndPassword(...args),
    signInWithEmailAndPassword: (...args: any[]) => mockSignInWithEmailAndPassword(...args),
    signOut: (...args: any[]) => mockSignOut(...args),
    doc: (...args: any[]) => mockDoc(...args),
    getDoc: (...args: any[]) => mockGetDoc(...args),
    setDoc: (...args: any[]) => mockSetDoc(...args),
    updateDoc: (...args: any[]) => mockUpdateDoc(...args),
    serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
    FirebaseError: MockFirebaseError,
  };
});

import {
  AuthError,
  NetworkError,
  NotFoundError,
  PermissionError,
  ValidationError,
} from '@pakyaw/shared/features/auth/errors';
import {
  createPassenger,
  signInDriver,
  signInPassenger,
} from '@pakyaw/shared/features/auth/services/auth.service';
import { FirebaseError } from '@/services/firebase/firebase';

function makeFirebaseError(code: string, message = 'Firebase error') {
  return new FirebaseError(code, message);
}

describe('auth.service — error translation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // createPassenger
  // -------------------------------------------------------------------------
  describe('createPassenger', () => {
    it('throws AuthError when email already in use', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/email-already-in-use'),
      );

      await expect(
        createPassenger('exists@test.com', 'password123'),
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('throws AuthError message without Firebase code', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/email-already-in-use'),
      );

      try {
        await createPassenger('exists@test.com', 'password123');
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        const authErr = err as AuthError;
        expect(authErr.message).not.toContain('auth/email-already-in-use');
        expect(authErr.message).toContain('already exists');
      }
    });

    it('throws NetworkError for auth/network-request-failed', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/network-request-failed'),
      );

      await expect(
        createPassenger('user@test.com', 'password123'),
      ).rejects.toBeInstanceOf(NetworkError);
    });

    it('throws ValidationError for auth/weak-password', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/weak-password'),
      );

      await expect(
        createPassenger('user@test.com', 'abc'),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError for auth/invalid-email', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/invalid-email'),
      );

      await expect(
        createPassenger('not-valid', 'password123'),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('returns uid string on success', async () => {
      mockCreateUserWithEmailAndPassword.mockResolvedValueOnce(
        { user: { uid: 'new-uid-123' } } as unknown as never,
      );

      const uid = await createPassenger('new@test.com', 'password123');
      expect(uid).toBe('new-uid-123');
    });
  });

  // -------------------------------------------------------------------------
  // signInPassenger
  // -------------------------------------------------------------------------
  describe('signInPassenger', () => {
    it('throws AuthError for wrong password', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/wrong-password'),
      );

      await expect(
        signInPassenger('user@test.com', 'wrong'),
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('throws AuthError for invalid credentials (new SDK code)', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/invalid-credential'),
      );

      await expect(
        signInPassenger('user@test.com', 'wrong'),
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('throws AuthError message does not expose Firebase code', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/wrong-password'),
      );

      try {
        await signInPassenger('user@test.com', 'wrong');
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        const msg = (err as AuthError).message;
        expect(msg).not.toContain('auth/wrong-password');
        expect(msg).not.toContain('auth/invalid-credential');
      }
    });

    it('throws NetworkError for network failure', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/network-request-failed'),
      );

      await expect(
        signInPassenger('user@test.com', 'password'),
      ).rejects.toBeInstanceOf(NetworkError);
    });

    it('returns uid on success', async () => {
      mockSignInWithEmailAndPassword.mockResolvedValueOnce(
        { user: { uid: 'existing-uid' } } as unknown as never,
      );

      const uid = await signInPassenger('user@test.com', 'password123');
      expect(uid).toBe('existing-uid');
    });
  });

  // -------------------------------------------------------------------------
  // signInDriver
  // -------------------------------------------------------------------------
  describe('signInDriver', () => {
    function mockSignIn(uid: string) {
      mockSignInWithEmailAndPassword.mockResolvedValueOnce(
        { user: { uid } } as unknown as never,
      );
    }

    function mockDocs(
      userDoc: object | null,
      driverDoc: object | null,
    ) {
      mockDoc.mockReturnValue({} as never);
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => userDoc !== null,
          data: () => userDoc,
        } as never)
        .mockResolvedValueOnce({
          exists: () => driverDoc !== null,
          data: () => driverDoc,
        } as never);
    }

    it('throws AuthError for wrong password', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/wrong-password'),
      );

      await expect(
        signInDriver('driver@test.com', 'wrong'),
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('throws NotFoundError when users doc does not exist', async () => {
      mockSignIn('uid-1');
      mockDocs(null, null);
      mockSignOut.mockResolvedValueOnce(undefined);

      await expect(
        signInDriver('driver@test.com', 'pass'),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws AuthError when role is not driver', async () => {
      mockSignIn('uid-2');
      mockDocs({ role: 'passenger' }, null);
      mockSignOut.mockResolvedValueOnce(undefined);

      await expect(
        signInDriver('driver@test.com', 'pass'),
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('throws NotFoundError when drivers doc does not exist', async () => {
      mockSignIn('uid-3');
      mockDocs({ role: 'driver' }, null);
      mockSignOut.mockResolvedValueOnce(undefined);

      await expect(
        signInDriver('driver@test.com', 'pass'),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws AuthError when driver is not approved', async () => {
      mockSignIn('uid-4');
      mockDocs({ role: 'driver' }, { approved: false });
      mockSignOut.mockResolvedValueOnce(undefined);

      await expect(
        signInDriver('driver@test.com', 'pass'),
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('returns uid and role on success', async () => {
      mockSignIn('uid-6');
      mockDocs({ role: 'driver' }, { approved: true });

      const result = await signInDriver('driver@test.com', 'pass');
      expect(result).toEqual({ uid: 'uid-6', role: 'driver' });
    });

    it('calls signOut after any post-auth Firestore failure', async () => {
      mockSignIn('uid-7');
      mockDocs(null, null);
      mockSignOut.mockResolvedValueOnce(undefined);

      await expect(
        signInDriver('driver@test.com', 'pass'),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Domain error kind assertions
  // -------------------------------------------------------------------------
  describe('domain error kinds', () => {
    it('AuthError has kind "AuthError"', () => {
      const err = new AuthError('test');
      expect(err.kind).toBe('AuthError');
    });

    it('NetworkError has kind "NetworkError"', () => {
      const err = new NetworkError();
      expect(err.kind).toBe('NetworkError');
    });

    it('ValidationError has kind "ValidationError"', () => {
      const err = new ValidationError('test');
      expect(err.kind).toBe('ValidationError');
    });

    it('PermissionError has kind "PermissionError"', () => {
      const err = new PermissionError();
      expect(err.kind).toBe('PermissionError');
    });

    it('NotFoundError has kind "NotFoundError"', () => {
      const err = new NotFoundError();
      expect(err.kind).toBe('NotFoundError');
    });
  });
});
