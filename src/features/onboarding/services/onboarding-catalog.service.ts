import type { DriverOnboardingCatalog } from '@pakyaw/shared/onboarding';
import { functions, httpsCallable } from '@/services/firebase/firebase';

export async function getDriverOnboardingCatalog(): Promise<DriverOnboardingCatalog> {
  const call = httpsCallable<void, DriverOnboardingCatalog>(functions, 'getDriverOnboardingCatalog');
  const result = await call();
  return result.data;
}
