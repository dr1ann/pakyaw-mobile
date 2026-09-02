import { env } from '@/services/env';
import {
  auth,
  doc,
  firestore,
  getDoc,
  serverTimestamp,
  setDoc,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from '@/services/firebase/firebase';

export class PhoneVerificationConfigurationError extends Error {
  constructor(message = 'Mobile verification is temporarily unavailable. Please try again later.') {
    super(message);
    this.name = 'PhoneVerificationConfigurationError';
  }
}

function isDevelopmentBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
}

export function normalizePhilippineMobile(value: string | undefined | null): string | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9+]/g, '');
  if (/^\+639\d{9}$/.test(digits)) return digits;
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
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

export async function startPassengerPhoneVerification(
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
      `[Phone Auth]\ndevelopment=true\ntestModeEnabled=${testModeEnabled}\nconfiguredNumberMatches=${configuredNumberMatches}\nverifier=native-phone-auth`,
    );
  }

  if (typeof authInstance.signInWithPhoneNumber !== 'function') {
    return signInWithPhoneNumber(auth as Auth, normalized);
  }

  return authInstance.signInWithPhoneNumber(normalized);
}

export async function createVerifiedPassengerProfile(input: {
  readonly name: string;
  readonly mobile: string;
  readonly termsAccepted: boolean;
  readonly privacyAccepted: boolean;
}): Promise<void> {
  const user = auth.currentUser;
  const normalizedInputMobile = normalizePhilippineMobile(input.mobile);
  const normalizedUserPhone = normalizePhilippineMobile(user?.phoneNumber ?? '');

  if (!user || !normalizedInputMobile || (normalizedUserPhone && normalizedUserPhone !== normalizedInputMobile)) {
    throw new Error('Verify this mobile number before creating an account.');
  }

  const trimmedName = input.name.trim();
  if (trimmedName.length < 2) {
    throw new Error('Enter your full name (at least 2 characters).');
  }

  if (!input.termsAccepted || !input.privacyAccepted) {
    throw new Error('You must accept the Terms of Service and Privacy Policy to continue.');
  }

  const userRef = doc(firestore, 'users', user.uid);
  const existing = await getDoc(userRef);

  if (existing.exists()) {
    const data = existing.data() as { role?: string; accountStatus?: string };
    if (data.role === 'passenger') {
      // Profile already exists for this UID; update if needed or return
      return;
    }
    throw new Error('This account already exists with a different role.');
  }

  await setDoc(userRef, {
    uid: user.uid,
    name: trimmedName,
    mobile: normalizedInputMobile,
    role: 'passenger',
    accountStatus: 'active',
    termsAcceptedAt: serverTimestamp(),
    privacyAcceptedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
