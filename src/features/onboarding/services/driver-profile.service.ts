import { doc, firestore, getDoc } from '@/services/firebase/firebase';

export type DriverOnboardingProfile = {
  readonly name: string;
  readonly mobile: string;
};

export type CanonicalDriverAccount = {
  readonly uid: string;
  readonly name: string;
  readonly mobile: string;
  readonly role: 'driver';
  readonly accountStatus: 'active';
};

export class DriverAccountNotReadyError extends Error {
  readonly code: 'missing' | 'role_mismatch' | 'inactive' | 'invalid_identity';

  constructor(code: 'missing' | 'role_mismatch' | 'inactive' | 'invalid_identity', message: string) {
    super(message);
    this.name = 'DriverAccountNotReadyError';
    this.code = code;
  }
}

function isDevelopmentBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

/** Reads only the authenticated driver's canonical profile fields used to prefill an application draft. */
export async function getDriverOnboardingProfile(uid: string): Promise<DriverOnboardingProfile | null> {
  const snapshot = await getDoc(doc(firestore, 'users', uid));
  if (!snapshot.exists()) return null;

  const value = snapshot.data();
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const mobile = typeof value.mobile === 'string' ? value.mobile.trim() : '';
  return name && mobile ? { name, mobile } : null;
}

/**
 * Explicitly resolves the driver's canonical users/{uid} document before application creation.
 * Throws DriverAccountNotReadyError if the account is missing, has role mismatch, is inactive, or has incomplete identity.
 */
export async function resolveCanonicalDriverAccount(uid: string): Promise<CanonicalDriverAccount> {
  const snapshot = await getDoc(doc(firestore, 'users', uid));
  if (!snapshot.exists()) {
    if (isDevelopmentBuild()) {
      console.warn('[Driver Onboarding] account identity not ready: users/{uid} does not exist');
    }
    throw new DriverAccountNotReadyError(
      'missing',
      'Your driver account profile does not exist. Complete account setup first.',
    );
  }

  const data = snapshot.data();
  if (data.role !== 'driver') {
    if (isDevelopmentBuild()) {
      console.warn('[Driver Onboarding] account identity not ready: role is not driver');
    }
    throw new DriverAccountNotReadyError(
      'role_mismatch',
      'This account is not registered as a driver.',
    );
  }

  if (data.accountStatus !== 'active') {
    if (isDevelopmentBuild()) {
      console.warn('[Driver Onboarding] account identity not ready: accountStatus is not active');
    }
    throw new DriverAccountNotReadyError(
      'inactive',
      `Your driver account is ${data.accountStatus || 'inactive'}.`,
    );
  }

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const mobile = typeof data.mobile === 'string' ? data.mobile.trim() : '';
  if (name.length < 2 || !mobile) {
    if (isDevelopmentBuild()) {
      console.warn('[Driver Onboarding] account identity not ready: name or mobile missing');
    }
    throw new DriverAccountNotReadyError(
      'invalid_identity',
      'Your driver account profile is incomplete.',
    );
  }

  return {
    uid,
    name,
    mobile,
    role: 'driver',
    accountStatus: 'active',
  };
}
