/**
 * auth.service.test.ts
 *
 * Unit tests for Firebase error → domain error translation.
 * Firebase SDK calls are mocked so no real network or Firebase app is needed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class MockFirebaseError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'FirebaseError';
      this.code = code;
    }
  }
  return {
    MockFirebaseError,
    mockCreateUserWithEmailAndPassword: vi.fn(),
    mockSignInWithEmailAndPassword: vi.fn(),
    mockSignOut: vi.fn(),
    mockDoc: vi.fn(),
    mockGetDoc: vi.fn(),
    mockSetDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
  };
});

const {
  MockFirebaseError,
  mockCreateUserWithEmailAndPassword,
  mockSignInWithEmailAndPassword,
  mockSignOut,
  mockDoc,
  mockGetDoc,
  mockSetDoc,
  mockUpdateDoc,
} = mocks;

vi.mock('@/services/firebase/firebase', () => ({
  auth: {},
  firestore: {},
  createUserWithEmailAndPassword: (...args: any[]) => mocks.mockCreateUserWithEmailAndPassword(...args),
  signInWithEmailAndPassword: (...args: any[]) => mocks.mockSignInWithEmailAndPassword(...args),
  signOut: (...args: any[]) => mocks.mockSignOut(...args),
  doc: (...args: any[]) => mocks.mockDoc(...args),
  getDoc: (...args: any[]) => mocks.mockGetDoc(...args),
  setDoc: (...args: any[]) => mocks.mockSetDoc(...args),
  updateDoc: (...args: any[]) => mocks.mockUpdateDoc(...args),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  FirebaseError: mocks.MockFirebaseError,
}));

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

function makeFirebaseError(code: string, message = 'Firebase error') {
  return new MockFirebaseError(code, message);
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
      }
    });

    it('throws ValidationError for weak-password', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/weak-password'),
      );

      await expect(
        createPassenger('test@test.com', '123'),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError for invalid-email', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/invalid-email'),
      );

      await expect(
        createPassenger('notanemail', 'password123'),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws NetworkError for network failure during create', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/network-request-failed'),
      );

      await expect(
        createPassenger('test@test.com', 'password123'),
      ).rejects.toBeInstanceOf(NetworkError);
    });

    it('returns uid on successful createPassenger', async () => {
      mockCreateUserWithEmailAndPassword.mockResolvedValueOnce({
        user: { uid: 'new-uid' },
      });

      const uid = await createPassenger('new@test.com', 'password123');
      expect(uid).toBe('new-uid');
    });
  });

  // -------------------------------------------------------------------------
  // signInPassenger
  // -------------------------------------------------------------------------
  describe('signInPassenger', () => {
    it('throws AuthError for wrong credentials', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/invalid-credential'),
      );

      await expect(
        signInPassenger('test@test.com', 'wrongpassword'),
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('returns uid on successful passenger sign-in', async () => {
      const mockAuthUser = { uid: 'p-uid' };

      mockSignInWithEmailAndPassword.mockResolvedValueOnce({ user: mockAuthUser });

      const uid = await signInPassenger('p@test.com', 'password123');
      expect(uid).toBe('p-uid');
    });
  });

  // -------------------------------------------------------------------------
  // signInDriver
  // -------------------------------------------------------------------------
  describe('signInDriver', () => {
    it('throws AuthError for wrong credentials', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(
        makeFirebaseError('auth/invalid-credential'),
      );

      await expect(
        signInDriver('driver@test.com', 'wrongpassword'),
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('returns uid and role on successful driver sign-in', async () => {
      const mockAuthUser = { uid: 'd-uid' };

      mockSignInWithEmailAndPassword.mockResolvedValueOnce({ user: mockAuthUser });

      const result = await signInDriver('driver@test.com', 'password123');
      expect(result.uid).toBe('d-uid');
      expect(result.role).toBe('driver');
    });
  });
});
