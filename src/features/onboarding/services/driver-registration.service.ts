import { composeStructuredLegalName } from '@pakyaw/shared/onboarding';
import { env } from '@/services/env';
import {
  auth,
  doc,
  firestore,
  getDoc,
  serverTimestamp,
  setDoc,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from '@/services/firebase/firebase';

function isDevelopmentBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
}

function firebaseErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return 'unknown';
}

function logOnboardingStage(message: string): void {
  if (isDevelopmentBuild()) {
    console.log(`[Driver Onboarding] ${message}`);
  }
}

function logOnboardingFailure(stage: string, error: unknown): void {
  if (isDevelopmentBuild()) {
    console.error(`[Driver Onboarding] ${stage} failed: ${firebaseErrorCode(error)}`);
  }
}

export class DriverPhoneVerificationConfigurationError extends Error {
  constructor() {
    super('Driver mobile verification is temporarily unavailable. Try again later.');
    this.name = 'DriverPhoneVerificationConfigurationError';
  }
}

export function normalizePhilippineMobile(value: string): string | null {
  const digits = value.replace(/[^0-9+]/g, '');
  if (/^\+639\d{9}$/.test(digits)) return digits;
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  return null;
}

export function normalizeToE164(value: string | undefined | null): string | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9+]/g, '');
  if (/^\+639\d{9}$/.test(digits)) return digits;
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\+[1-9]\d{6,14}$/.test(digits)) return digits;
  return null;
}

export async function startDriverPhoneVerification(
  mobile: string,
  authInstance: {
    signInWithPhoneNumber?: (phone: string, ...args: unknown[]) => Promise<ConfirmationResult>;
    settings?: { appVerificationDisabledForTesting?: boolean };
  } = auth,
): Promise<ConfirmationResult> {
  const normalized = normalizePhilippineMobile(mobile);
  if (!normalized) throw new Error('Enter a valid Philippine mobile number.');

  const isDev = isDevelopmentBuild();
  const testModeEnabled = env.EXPO_PUBLIC_PHONE_AUTH_TEST_MODE === 'true';
  const configuredTestNumber = env.EXPO_PUBLIC_PHONE_AUTH_TEST_NUMBER;
  const normalizedConfigured = normalizeToE164(configuredTestNumber);
  const normalizedEntered = normalizeToE164(normalized);
  const configuredNumberMatches =
    Boolean(normalizedConfigured) &&
    Boolean(normalizedEntered) &&
    normalizedConfigured === normalizedEntered;

  const isTestPhone = isDev && testModeEnabled && configuredNumberMatches;

  if (authInstance.settings) {
    authInstance.settings.appVerificationDisabledForTesting = isTestPhone;
  }

  if (isDev) {
    console.log(
      `[Phone Auth]\ndevelopment=${isDev}\ntestModeEnabled=${testModeEnabled}\nconfiguredNumberMatches=${configuredNumberMatches}\nverifier=native-phone-auth`,
    );
  }

  if (typeof authInstance.signInWithPhoneNumber === 'function') {
    return authInstance.signInWithPhoneNumber(normalized);
  }

  return signInWithPhoneNumber(auth as any, normalized as any);
}

export type StructuredDriverLegalName = {
  readonly firstName: string;
  readonly middleName?: string;
  readonly lastName: string;
  readonly suffix?: string;
};

export async function createVerifiedDriverProfile(input: {
  readonly legalName?: StructuredDriverLegalName;
  readonly name?: string;
  readonly mobile: string;
  readonly termsAccepted: boolean;
  readonly privacyAccepted: boolean;
}): Promise<string> {
  const user = auth.currentUser;
  const mobile = normalizePhilippineMobile(input.mobile);
  if (!user || !mobile || user.phoneNumber !== mobile) {
    throw new Error('Verify this mobile number before creating an application.');
  }

  const derivedFullName = input.legalName
    ? composeStructuredLegalName(input.legalName)
    : (input.name ?? '').trim();

  if (derivedFullName.length < 2 || !input.termsAccepted || !input.privacyAccepted) {
    throw new Error('Enter your legal name and accept the Terms and Privacy Policy.');
  }

  const userRef = doc(firestore, 'users', user.uid);
  let existing;
  try {
    existing = await getDoc(userRef);
  } catch (error) {
    logOnboardingFailure('users/{uid} lookup', error);
    throw error;
  }
  if (existing.exists()) {
    const data = existing.data() as { role?: string };
    if (data.role === 'passenger') {
      await signOut(auth).catch(() => undefined);
      throw new Error(
        'This mobile number is registered to a Pakyaw Passenger account. Sign in using the Pakyaw Passenger app.',
      );
    }
    throw new Error('This verified mobile already has a Pakyaw account. Sign in instead.');
  }

  logOnboardingStage('creating users/{uid}');
  try {
    await setDoc(userRef, {
      uid: user.uid,
      name: derivedFullName,
      mobile,
      termsAcceptedAt: serverTimestamp(),
      privacyAcceptedAt: serverTimestamp(),
      accountStatus: 'active',
      role: 'driver',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logOnboardingFailure('users/{uid} create', error);
    throw error;
  }
  logOnboardingStage('users/{uid} created');

  return user.uid;
}
