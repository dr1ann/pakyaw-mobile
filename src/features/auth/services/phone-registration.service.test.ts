import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfirmationResult } from '@/services/firebase/firebase';

const mocks = vi.hoisted(() => {
  const fakeEnv = {
    EXPO_PUBLIC_PHONE_AUTH_TEST_MODE: 'true',
    EXPO_PUBLIC_PHONE_AUTH_TEST_NUMBER: '+639171234567',
  };
  const mockCurrentUser = { uid: 'test-passenger-uid', phoneNumber: '+639171234567' };
  const mockDoc = vi.fn((_fs, _col, id) => ({ path: `users/${id}`, id }));
  const mockGetDoc = vi.fn();
  const mockSetDoc = vi.fn();
  const mockServerTimestamp = vi.fn(() => ({ _type: 'serverTimestamp' }));
  const mockSignOut = vi.fn(() => Promise.resolve());

  return {
    fakeEnv,
    mockCurrentUser,
    mockDoc,
    mockGetDoc,
    mockSetDoc,
    mockServerTimestamp,
    mockSignOut,
  };
});

vi.mock('@/services/env', () => ({ env: mocks.fakeEnv }));

vi.mock('@/services/firebase/firebase', () => ({
  auth: {
    currentUser: mocks.mockCurrentUser,
    settings: { appVerificationDisabledForTesting: false },
    signInWithPhoneNumber: vi.fn(),
  },
  firestore: {},
  doc: (first: any, ...rest: string[]) => (mocks.mockDoc as any)(first, ...rest),
  getDoc: (docRef: any) => mocks.mockGetDoc(docRef),
  setDoc: (docRef: any, data: any) => mocks.mockSetDoc(docRef, data),
  signOut: () => mocks.mockSignOut(),
  serverTimestamp: () => mocks.mockServerTimestamp(),
  signInWithPhoneNumber: vi.fn(),
}));

import {
  createVerifiedPassengerProfile,
  normalizePhilippineMobile,
  startPassengerPhoneVerification,
  verifyAndResolvePassengerSignIn,
} from './phone-registration.service';
import { auth } from '@/services/firebase/firebase';

describe('phone-registration.service', () => {
  const testAuth = {
    settings: { appVerificationDisabledForTesting: false },
    signInWithPhoneNumber: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__DEV__ = true;
    mocks.fakeEnv.EXPO_PUBLIC_PHONE_AUTH_TEST_MODE = 'true';
    mocks.fakeEnv.EXPO_PUBLIC_PHONE_AUTH_TEST_NUMBER = '+639171234567';
    (auth as any).currentUser = mocks.mockCurrentUser;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('normalizePhilippineMobile', () => {
    it.each([
      ['+639171234567', '+639171234567'],
      ['09171234567', '+639171234567'],
      ['9171234567', '+639171234567'],
      ['639171234567', '+639171234567'],
    ])('normalizes %s to %s', (value, expected) => {
      expect(normalizePhilippineMobile(value)).toBe(expected);
    });

    it('rejects invalid mobile numbers', () => {
      expect(normalizePhilippineMobile('08171234567')).toBeNull();
      expect(normalizePhilippineMobile('917123456')).toBeNull();
      expect(normalizePhilippineMobile('')).toBeNull();
      expect(normalizePhilippineMobile(null)).toBeNull();
    });
  });

  describe('startPassengerPhoneVerification', () => {
    it('rejects invalid mobile number before invoking native auth', async () => {
      await expect(startPassengerPhoneVerification('12345', testAuth as any)).rejects.toThrow(
        'Enter a valid Philippine mobile number.',
      );
      expect(testAuth.signInWithPhoneNumber).not.toHaveBeenCalled();
    });

    it('invokes signInWithPhoneNumber for valid mobile number', async () => {
      const fakeConfirmation = { verificationId: 'v-123' } as unknown as ConfirmationResult;
      testAuth.signInWithPhoneNumber.mockResolvedValueOnce(fakeConfirmation);

      const result = await startPassengerPhoneVerification('09171234567', testAuth as any);
      expect(result).toBe(fakeConfirmation);
      expect(testAuth.signInWithPhoneNumber).toHaveBeenCalledWith('+639171234567');
      expect(testAuth.settings.appVerificationDisabledForTesting).toBe(true);
    });

    it('disables test verification mode for non-test numbers', async () => {
      const fakeConfirmation = { verificationId: 'v-real' } as unknown as ConfirmationResult;
      testAuth.signInWithPhoneNumber.mockResolvedValueOnce(fakeConfirmation);

      const result = await startPassengerPhoneVerification('09181234567', testAuth as any);
      expect(result).toBe(fakeConfirmation);
      expect(testAuth.settings.appVerificationDisabledForTesting).toBe(false);
      expect(testAuth.signInWithPhoneNumber).toHaveBeenCalledWith('+639181234567');
    });
  });

  describe('createVerifiedPassengerProfile', () => {
    it('throws when user is not authenticated', async () => {
      (auth as any).currentUser = null;

      await expect(
        createVerifiedPassengerProfile({
          firstName: 'Maria',
          lastName: 'Santos',
          mobile: '09171234567',
          termsAccepted: true,
          privacyAccepted: true,
        }),
      ).rejects.toThrow('Verify this mobile number before creating an account.');
    });

    it('throws when first name is empty', async () => {
      await expect(
        createVerifiedPassengerProfile({
          firstName: '  ',
          lastName: 'Santos',
          mobile: '09171234567',
          termsAccepted: true,
          privacyAccepted: true,
        }),
      ).rejects.toThrow('Enter your first name.');
    });

    it('throws when last name is empty', async () => {
      await expect(
        createVerifiedPassengerProfile({
          firstName: 'Maria',
          lastName: '  ',
          mobile: '09171234567',
          termsAccepted: true,
          privacyAccepted: true,
        }),
      ).rejects.toThrow('Enter your last name.');
    });

    it('throws when Terms or Privacy are not accepted', async () => {
      await expect(
        createVerifiedPassengerProfile({
          firstName: 'Maria',
          lastName: 'Santos',
          mobile: '09171234567',
          termsAccepted: false,
          privacyAccepted: true,
        }),
      ).rejects.toThrow('You must accept the Terms of Service and Privacy Policy to continue.');

      await expect(
        createVerifiedPassengerProfile({
          firstName: 'Maria',
          lastName: 'Santos',
          mobile: '09171234567',
          termsAccepted: true,
          privacyAccepted: false,
        }),
      ).rejects.toThrow('You must accept the Terms of Service and Privacy Policy to continue.');
    });

    it('creates canonical users/{uid} document with active passenger status and composed name', async () => {
      mocks.mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await createVerifiedPassengerProfile({
        firstName: 'Maria',
        lastName: 'Santos',
        mobile: '09171234567',
        termsAccepted: true,
        privacyAccepted: true,
      });

      expect(mocks.mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/test-passenger-uid' }),
        expect.objectContaining({
          uid: 'test-passenger-uid',
          firstName: 'Maria',
          lastName: 'Santos',
          name: 'Maria Santos',
          mobile: '+639171234567',
          role: 'passenger',
          accountStatus: 'active',
        }),
      );
    });

    it('gracefully handles already existing passenger profile', async () => {
      mocks.mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'passenger', accountStatus: 'active' }),
      });

      await expect(
        createVerifiedPassengerProfile({
          firstName: 'Maria',
          lastName: 'Santos',
          mobile: '09171234567',
          termsAccepted: true,
          privacyAccepted: true,
        }),
      ).resolves.toBeUndefined();

      expect(mocks.mockSetDoc).not.toHaveBeenCalled();
    });

    it('throws if profile already exists with a different role', async () => {
      mocks.mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'driver', accountStatus: 'active' }),
      });

      await expect(
        createVerifiedPassengerProfile({
          firstName: 'Maria',
          lastName: 'Santos',
          mobile: '09171234567',
          termsAccepted: true,
          privacyAccepted: true,
        }),
      ).rejects.toThrow('This account already exists with a different role.');
    });
  });

  describe('verifyAndResolvePassengerSignIn', () => {
    it('throws if OTP code is less than 6 characters', async () => {
      const mockConfirmation = { confirm: vi.fn() } as unknown as ConfirmationResult;

      await expect(verifyAndResolvePassengerSignIn(mockConfirmation, '12345')).rejects.toThrow(
        'Please enter the 6-digit verification code.',
      );
      expect(mockConfirmation.confirm).not.toHaveBeenCalled();
    });

    it('confirms OTP and resolves active passenger session', async () => {
      const mockConfirmation = {
        confirm: vi.fn().mockResolvedValueOnce({
          user: { uid: 'passenger-active-uid' },
        }),
      } as unknown as ConfirmationResult;

      const profile = {
        uid: 'passenger-active-uid',
        name: 'Maria Santos',
        role: 'passenger',
        accountStatus: 'active',
      };

      mocks.mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => profile,
      });

      const resolution = await verifyAndResolvePassengerSignIn(mockConfirmation, '123456');

      expect(mockConfirmation.confirm).toHaveBeenCalledWith('123456');
      expect(resolution).toEqual({
        status: 'active',
        uid: 'passenger-active-uid',
        profile,
      });
      expect(mocks.mockSignOut).not.toHaveBeenCalled();
    });

    it('signs out and returns needs_recovery when passenger user document is missing', async () => {
      const mockConfirmation = {
        confirm: vi.fn().mockResolvedValueOnce({
          user: { uid: 'passenger-missing-uid' },
        }),
      } as unknown as ConfirmationResult;

      mocks.mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const resolution = await verifyAndResolvePassengerSignIn(mockConfirmation, '123456');

      expect(resolution).toEqual({
        status: 'needs_recovery',
        uid: 'passenger-missing-uid',
      });
      // Verifies that missing profile does not silently create one and signs out auth user
      expect(mocks.mockSetDoc).not.toHaveBeenCalled();
      expect(mocks.mockSignOut).toHaveBeenCalled();
    });

    it('signs out and returns invalid_role when user has a driver role', async () => {
      const mockConfirmation = {
        confirm: vi.fn().mockResolvedValueOnce({
          user: { uid: 'driver-uid' },
        }),
      } as unknown as ConfirmationResult;

      mocks.mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'driver', accountStatus: 'active' }),
      });

      const resolution = await verifyAndResolvePassengerSignIn(mockConfirmation, '123456');

      expect(resolution).toEqual({
        status: 'invalid_role',
        uid: 'driver-uid',
        role: 'driver',
      });
      expect(mocks.mockSignOut).toHaveBeenCalled();
    });

    it('returns suspended when account status is suspended without signing out', async () => {
      const mockConfirmation = {
        confirm: vi.fn().mockResolvedValueOnce({
          user: { uid: 'passenger-susp-uid' },
        }),
      } as unknown as ConfirmationResult;

      const profile = {
        uid: 'passenger-susp-uid',
        name: 'Suspended User',
        role: 'passenger',
        accountStatus: 'suspended',
      };

      mocks.mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => profile,
      });

      const resolution = await verifyAndResolvePassengerSignIn(mockConfirmation, '123456');

      expect(resolution).toEqual({
        status: 'suspended',
        uid: 'passenger-susp-uid',
        profile,
      });
      expect(mocks.mockSignOut).not.toHaveBeenCalled();
    });

    it('returns blocked when account status is blocked without signing out', async () => {
      const mockConfirmation = {
        confirm: vi.fn().mockResolvedValueOnce({
          user: { uid: 'passenger-block-uid' },
        }),
      } as unknown as ConfirmationResult;

      const profile = {
        uid: 'passenger-block-uid',
        name: 'Blocked User',
        role: 'passenger',
        accountStatus: 'blocked',
      };

      mocks.mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => profile,
      });

      const resolution = await verifyAndResolvePassengerSignIn(mockConfirmation, '123456');

      expect(resolution).toEqual({
        status: 'blocked',
        uid: 'passenger-block-uid',
        profile,
      });
      expect(mocks.mockSignOut).not.toHaveBeenCalled();
    });

    it('propagates error when OTP confirmation fails (invalid or expired code)', async () => {
      const mockConfirmation = {
        confirm: vi.fn().mockRejectedValueOnce(new Error('auth/invalid-verification-code')),
      } as unknown as ConfirmationResult;

      await expect(verifyAndResolvePassengerSignIn(mockConfirmation, '000000')).rejects.toThrow(
        'auth/invalid-verification-code',
      );
    });
  });
});
