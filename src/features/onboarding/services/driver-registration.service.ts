import type { ApplicationVerifier, ConfirmationResult } from 'firebase/auth';
import { signInWithPhoneNumber } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, firestore } from '@/services/firebase/firebase';

export class DriverPhoneVerificationConfigurationError extends Error {
  constructor() {
    super('Driver mobile verification is temporarily unavailable. Please try again later.');
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

export async function startDriverPhoneVerification(
  mobile: string,
  verifier: ApplicationVerifier,
): Promise<ConfirmationResult> {
  const normalized = normalizePhilippineMobile(mobile);
  if (!normalized) throw new Error('Enter a valid Philippine mobile number.');
  if (!verifier) throw new DriverPhoneVerificationConfigurationError();
  return signInWithPhoneNumber(auth, normalized, verifier);
}

export async function createVerifiedDriverProfile(input: {
  readonly name: string;
  readonly mobile: string;
  readonly termsAccepted: boolean;
  readonly privacyAccepted: boolean;
}): Promise<string> {
  const user = auth.currentUser;
  const mobile = normalizePhilippineMobile(input.mobile);
  if (!user || !mobile || user.phoneNumber !== mobile) throw new Error('Verify this mobile number before creating an application.');
  if (input.name.trim().length < 2 || !input.termsAccepted || !input.privacyAccepted) throw new Error('Enter your name and accept the Terms and Privacy Policy.');
  await setDoc(doc(firestore, 'users', user.uid), {
    uid: user.uid,
    name: input.name.trim(),
    mobile,
    termsAcceptedAt: serverTimestamp(),
    privacyAcceptedAt: serverTimestamp(),
    accountStatus: 'active',
    role: 'driver',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return user.uid;
}
