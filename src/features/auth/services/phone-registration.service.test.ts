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

  return {
    fakeEnv,
    mockCurrentUser,
    mockDoc,
    mockGetDoc,
    mockSetDoc,
    mockServerTimestamp,
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
  serverTimestamp: () => mocks.mockServerTimestamp(),
  signInWithPhoneNumber: vi.fn(),
}));

import {
  createVerifiedPassengerProfile,
  normalizePhilippineMobile,
  startPassengerPhoneVerification,
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
          name: 'Maria Santos',
          mobile: '09171234567',
          termsAccepted: true,
          privacyAccepted: true,
        }),
      ).rejects.toThrow('Verify this mobile number before creating an account.');
    });

    it('throws when full name is shorter than 2 characters', async () => {
      await expect(
        createVerifiedPassengerProfile({
          name: 'M',
          mobile: '09171234567',
          termsAccepted: true,
          privacyAccepted: true,
        }),
      ).rejects.toThrow('Enter your full name (at least 2 characters).');
    });

    it('throws when Terms or Privacy are not accepted', async () => {
      await expect(
        createVerifiedPassengerProfile({
          name: 'Maria Santos',
          mobile: '09171234567',
          termsAccepted: false,
          privacyAccepted: true,
        }),
      ).rejects.toThrow('You must accept the Terms of Service and Privacy Policy to continue.');

      await expect(
        createVerifiedPassengerProfile({
          name: 'Maria Santos',
          mobile: '09171234567',
          termsAccepted: true,
          privacyAccepted: false,
        }),
      ).rejects.toThrow('You must accept the Terms of Service and Privacy Policy to continue.');
    });

    it('creates canonical users/{uid} document with active passenger status', async () => {
      mocks.mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await createVerifiedPassengerProfile({
        name: 'Maria Santos',
        mobile: '09171234567',
        termsAccepted: true,
        privacyAccepted: true,
      });

      expect(mocks.mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/test-passenger-uid' }),
        expect.objectContaining({
          uid: 'test-passenger-uid',
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
          name: 'Maria Santos',
          mobile: '09171234567',
          termsAccepted: true,
          privacyAccepted: true,
        }),
      ).resolves.toBeUndefined();

      expect(mocks.mockSetDoc).not.toHaveBeenCalled();
    });
  });
});
