import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfirmationResult } from '@/services/firebase/firebase';

const fakeEnv = vi.hoisted(() => ({
  EXPO_PUBLIC_PHONE_AUTH_TEST_MODE: 'true',
  EXPO_PUBLIC_PHONE_AUTH_TEST_NUMBER: '+639171234567',
}));

vi.mock('@/services/env', () => ({ env: fakeEnv }));

vi.mock('@/services/firebase/firebase', () => ({
  auth: {
    currentUser: null,
    settings: { appVerificationDisabledForTesting: false },
    signInWithPhoneNumber: vi.fn(),
  },
  firestore: {},
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

import { auth, getDoc, setDoc } from '@/services/firebase/firebase';
import {
  createVerifiedDriverProfile,
  normalizePhilippineMobile,
  normalizeToE164,
  startDriverPhoneVerification,
} from './driver-registration.service';

const testAuth = auth as unknown as {
  currentUser: { uid: string; phoneNumber: string } | null;
  settings: { appVerificationDisabledForTesting: boolean };
  signInWithPhoneNumber: ReturnType<typeof vi.fn>;
};

describe('driver registration mobile normalization', () => {
  it.each([
    ['+639171234567', '+639171234567'],
    ['09171234567', '+639171234567'],
    ['9171234567', '+639171234567'],
  ])('normalizes %s', (value, expected) =>
    expect(normalizePhilippineMobile(value)).toBe(expected),
  );
  it('rejects non-Philippine mobile values', () =>
    expect(normalizePhilippineMobile('08171234567')).toBeNull());

  it('normalizes E.164 values correctly', () => {
    expect(normalizeToE164('09171234567')).toBe('+639171234567');
    expect(normalizeToE164('+63 917 123 4567')).toBe('+639171234567');
    expect(normalizeToE164('0917-123-4567')).toBe('+639171234567');
    expect(normalizeToE164('+15555555555')).toBe('+15555555555');
    expect(normalizeToE164(null)).toBeNull();
  });
});

describe('startDriverPhoneVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('__DEV__', true);
    fakeEnv.EXPO_PUBLIC_PHONE_AUTH_TEST_MODE = 'true';
    fakeEnv.EXPO_PUBLIC_PHONE_AUTH_TEST_NUMBER = '+639171234567';
    testAuth.settings.appVerificationDisabledForTesting = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects when mobile number is invalid', async () => {
    await expect(startDriverPhoneVerification('invalid-phone', testAuth as any)).rejects.toThrow(
      'Enter a valid Philippine mobile number.',
    );
  });

  it('configured fictional number → sets appVerificationDisabledForTesting and logs diagnostics', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fakeConfirmation = { verificationId: 'v-123' } as unknown as ConfirmationResult;
    testAuth.signInWithPhoneNumber.mockResolvedValueOnce(fakeConfirmation);

    const result = await startDriverPhoneVerification('09171234567', testAuth as any);
    expect(result).toBe(fakeConfirmation);
    expect(testAuth.settings.appVerificationDisabledForTesting).toBe(true);
    expect(testAuth.signInWithPhoneNumber).toHaveBeenCalledWith('+639171234567');

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[Phone Auth]\ndevelopment=true\ntestModeEnabled=true\nconfiguredNumberMatches=true\nverifier=native-phone-auth',
      ),
    );
  });

  it('real phone number → keeps appVerificationDisabledForTesting false and logs diagnostics', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fakeConfirmation = { verificationId: 'v-real' } as unknown as ConfirmationResult;
    testAuth.signInWithPhoneNumber.mockResolvedValueOnce(fakeConfirmation);

    const result = await startDriverPhoneVerification('09181234567', testAuth as any);
    expect(result).toBe(fakeConfirmation);
    expect(testAuth.settings.appVerificationDisabledForTesting).toBe(false);
    expect(testAuth.signInWithPhoneNumber).toHaveBeenCalledWith('+639181234567');

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[Phone Auth]\ndevelopment=true\ntestModeEnabled=true\nconfiguredNumberMatches=false\nverifier=native-phone-auth',
      ),
    );
  });

  it('propagates rejection when signInWithPhoneNumber fails', async () => {
    const error = new Error('SMS quota exceeded');
    testAuth.signInWithPhoneNumber.mockRejectedValueOnce(error);

    await expect(startDriverPhoneVerification('09181234567', testAuth as any)).rejects.toThrow(
      'SMS quota exceeded',
    );
  });
});

describe('createVerifiedDriverProfile development logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('__DEV__', true);
    testAuth.currentUser = { uid: 'driver-uid', phoneNumber: '+639171234567' };
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
    vi.mocked(setDoc).mockResolvedValue(undefined);
  });

  afterEach(() => {
    testAuth.currentUser = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const validInput = {
    legalName: {
      firstName: 'Juan',
      lastName: 'Dela Cruz',
    },
    mobile: '09171234567',
    termsAccepted: true,
    privacyAccepted: true,
  };

  it('logs the canonical account stage without private data', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await createVerifiedDriverProfile(validInput);

    expect(logSpy.mock.calls.map(([message]) => message)).toEqual([
      '[Driver Onboarding] creating users/{uid}',
      '[Driver Onboarding] users/{uid} created',
    ]);
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('driver-uid'));
  });

  it('logs the users create stage and Firebase error code on failure', async () => {
    vi.mocked(setDoc).mockRejectedValueOnce({ code: 'permission-denied' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(createVerifiedDriverProfile(validInput)).rejects.toMatchObject({
      code: 'permission-denied',
    });

    expect(testAuth.currentUser?.uid).toBe('driver-uid');
    expect(errorSpy).toHaveBeenCalledWith(
      '[Driver Onboarding] users/{uid} create failed: permission-denied',
    );
  });
});
