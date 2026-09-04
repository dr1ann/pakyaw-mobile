import { doc, firestore, getDoc } from '@/services/firebase/firebase';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import type { UserDoc } from '@pakyaw/shared/features/auth/types';
import { usePassengerSessionStore } from '@/features/auth/stores/passenger-session.store';

export type PassengerSessionResolution =
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'needs_recovery'; readonly uid: string }
  | { readonly status: 'invalid_role'; readonly uid: string; readonly role: string }
  | { readonly status: 'suspended'; readonly uid: string; readonly profile: UserDoc }
  | { readonly status: 'blocked'; readonly uid: string; readonly profile: UserDoc }
  | { readonly status: 'active'; readonly uid: string; readonly profile: UserDoc };

export async function resolvePassengerSession(uid: string): Promise<PassengerSessionResolution> {
  const userSnap = await getDoc(doc(firestore, 'users', uid));

  if (!userSnap.exists()) {
    return { status: 'needs_recovery', uid };
  }

  const profile = userSnap.data() as UserDoc;

  if (profile.role !== 'passenger') {
    return { status: 'invalid_role', uid, role: profile.role ?? 'unknown' };
  }

  if (profile.accountStatus === 'suspended') {
    return { status: 'suspended', uid, profile };
  }

  if (profile.accountStatus === 'blocked') {
    return { status: 'blocked', uid, profile };
  }

  return { status: 'active', uid, profile };
}

export function storePassengerSessionResolution(resolution: PassengerSessionResolution): void {
  const passengerStore = usePassengerSessionStore.getState();
  const sessionStore = useSessionStore.getState();

  switch (resolution.status) {
    case 'unauthenticated':
      passengerStore.clear();
      sessionStore.clear();
      break;

    case 'needs_recovery':
      passengerStore.clear();
      sessionStore.clear();
      break;

    case 'invalid_role':
      passengerStore.clear();
      sessionStore.clear();
      break;

    case 'suspended':
      passengerStore.setSuspended(resolution.uid, resolution.profile);
      sessionStore.clear();
      break;

    case 'blocked':
      passengerStore.setBlocked(resolution.uid, resolution.profile);
      sessionStore.clear();
      break;

    case 'active':
      passengerStore.setActive(resolution.uid, resolution.profile);
      sessionStore.setSession(resolution.uid, 'passenger');
      break;
  }
}
