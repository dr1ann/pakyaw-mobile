import { doc, getDoc } from 'firebase/firestore';

import { firestore } from '@/services/firebase/firebase';

export type DriverOnboardingProfile = {
  readonly name: string;
  readonly mobile: string;
};

/** Reads only the authenticated driver's canonical profile fields used to prefill an application draft. */
export async function getDriverOnboardingProfile(uid: string): Promise<DriverOnboardingProfile | null> {
  const snapshot = await getDoc(doc(firestore, 'users', uid));
  if (!snapshot.exists()) return null;

  const value = snapshot.data();
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const mobile = typeof value.mobile === 'string' ? value.mobile.trim() : '';
  return name && mobile ? { name, mobile } : null;
}
