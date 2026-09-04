import type { UserDoc, UserRole } from '@pakyaw/shared/features/auth/types';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import type { ApplicationStatus } from '@pakyaw/shared/onboarding';
import { doc, firestore, getDoc } from '@/services/firebase/firebase';
import { useDriverSessionStore } from '@/features/auth/stores/driver-session.store';

export type DriverSessionStatus =
  | 'loading'
  | 'unauthenticated'
  | 'authenticated_account_missing'
  | 'authenticated_role_mismatch'
  | 'authenticated_driver_application_missing'
  | 'driver_application_draft'
  | 'driver_application_submitted'
  | 'driver_application_needs_correction'
  | 'driver_application_rejected'
  | 'driver_application_approved'
  | 'account_suspended'
  | 'account_blocked'
  | 'driver_session_error';

export type DriverSessionResolution = {
  readonly status: Exclude<DriverSessionStatus, 'loading' | 'unauthenticated'>;
  readonly uid: string;
  readonly role: UserRole | null;
  readonly userDoc?: UserDoc;
};

type ApplicationRecord = {
  readonly status?: unknown;
};

export function applicationStatusToSessionStatus(
  applicationStatus: unknown,
): Extract<DriverSessionStatus, `driver_application_${string}`> | 'driver_session_error' {
  switch (applicationStatus as ApplicationStatus | 'under_review') {
    case 'draft':
      return 'driver_application_draft';
    case 'submitted':
    case 'under_review':
      return 'driver_application_submitted';
    case 'needs_correction':
      return 'driver_application_needs_correction';
    case 'rejected':
      return 'driver_application_rejected';
    case 'approved':
      return 'driver_application_approved';
    default:
      return 'driver_session_error';
  }
}

export function deriveDriverSessionStatus(
  userDoc: UserDoc | null,
  application: ApplicationRecord | null,
): DriverSessionStatus {
  if (!userDoc) return 'authenticated_account_missing';
  if (userDoc.role !== 'driver') return 'authenticated_role_mismatch';
  if (userDoc.accountStatus === 'suspended') return 'account_suspended';
  if (userDoc.accountStatus === 'blocked') return 'account_blocked';
  if (userDoc.accountStatus !== 'active') return 'driver_session_error';
  if (!application) return 'authenticated_driver_application_missing';
  return applicationStatusToSessionStatus(application.status);
}

export function isDriverWorkspaceState(status: DriverSessionStatus): boolean {
  return status === 'driver_application_approved';
}

export function driverSessionStatusForAuthUser(
  user: { readonly uid: string } | null,
): 'loading' | 'unauthenticated' {
  return user ? 'loading' : 'unauthenticated';
}

export function isDriverApplicationState(status: DriverSessionStatus): boolean {
  return (
    status === 'authenticated_driver_application_missing' ||
    status === 'driver_application_draft' ||
    status === 'driver_application_submitted' ||
    status === 'driver_application_needs_correction' ||
    status === 'driver_application_rejected'
  );
}

export async function resolveDriverSession(uid: string): Promise<DriverSessionResolution> {
  const userSnapshot = await getDoc(doc(firestore, 'users', uid));
  if (!userSnapshot.exists()) {
    return {
      status: 'authenticated_account_missing',
      uid,
      role: null,
    };
  }

  const userDoc = userSnapshot.data() as UserDoc;
  const accountStatus = deriveDriverSessionStatus(userDoc, null);
  if (
    accountStatus === 'authenticated_role_mismatch' ||
    accountStatus === 'account_suspended' ||
    accountStatus === 'account_blocked' ||
    accountStatus === 'driver_session_error'
  ) {
    return { status: accountStatus, uid, role: userDoc.role, userDoc };
  }

  const applicationSnapshot = await getDoc(doc(firestore, 'driverApplications', uid));
  const application = applicationSnapshot.exists()
    ? (applicationSnapshot.data() as ApplicationRecord)
    : null;
  const derivedStatus = deriveDriverSessionStatus(userDoc, application);
  const status: Exclude<DriverSessionStatus, 'loading' | 'unauthenticated'> =
    derivedStatus === 'loading' || derivedStatus === 'unauthenticated'
      ? 'driver_session_error'
      : derivedStatus;
  return { status, uid, role: userDoc.role, userDoc };
}

export function storeDriverSessionResolution(
  resolution: DriverSessionResolution,
): void {
  if (
    resolution.role === 'driver' &&
    resolution.status !== 'authenticated_role_mismatch' &&
    resolution.status !== 'authenticated_account_missing'
  ) {
    useDriverSessionStore.getState().setResolution(resolution);
    useSessionStore.getState().setSession(resolution.uid, 'driver');
  } else {
    useDriverSessionStore.getState().clear();
    useSessionStore.getState().clear();
  }
}

export async function resolveAndStoreDriverSession(
  uid: string,
): Promise<DriverSessionResolution> {
  try {
    const resolution = await resolveDriverSession(uid);
    if (
      resolution.status === 'authenticated_account_missing' ||
      resolution.status === 'authenticated_role_mismatch' ||
      resolution.role !== 'driver'
    ) {
      const { auth, signOut } = await import('@/services/firebase/firebase');
      await signOut(auth).catch(() => undefined);
      useSessionStore.getState().clear();
      useDriverSessionStore.getState().clear();
      return resolution;
    }
    storeDriverSessionResolution(resolution);
    return resolution;
  } catch (error) {
    useSessionStore.getState().clear();
    useDriverSessionStore.getState().setResolutionError(uid);
    throw error;
  }
}
