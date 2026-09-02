import { useEffect } from 'react';

import { logger } from '@pakyaw/shared/lib/logger';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { auth, doc, firestore, onAuthStateChanged, onSnapshot } from '@/services/firebase/firebase';
import { useDriverSessionStore } from '@/features/auth/stores/driver-session.store';
import {
  driverSessionStatusForAuthUser,
  resolveDriverSession,
  storeDriverSessionResolution,
} from '@/features/auth/services/driver-session.service';

export function useDriverSessionBootstrap(): void {
  useEffect(() => {
    let mounted = true;
    let resolutionGeneration = 0;
    let unsubApplication: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
      const generation = ++resolutionGeneration;
      unsubApplication?.();
      unsubApplication = null;

      // The registration and email sign-in flows resolve their session after
      // their own Firestore work. This prevents the auth event from routing
      // ahead of that work while keeping Firebase Auth persistence enabled.
      if (useSessionStore.getState().signingIn) return;

      if (!user) {
        if (driverSessionStatusForAuthUser(user) !== 'unauthenticated') return;
        useDriverSessionStore.getState().clear();
        useSessionStore.getState().clear();
        return;
      }

      useDriverSessionStore.getState().beginResolving(user.uid);
      void resolveDriverSession(user.uid)
        .then((resolution) => {
          if (!mounted || generation !== resolutionGeneration) return;
          storeDriverSessionResolution(resolution);
        })
        .catch((error: unknown) => {
          if (!mounted || generation !== resolutionGeneration) return;
          logger.error('[Driver Session] resolution failed', error);
          useSessionStore.getState().clear();
          useDriverSessionStore.getState().setResolutionError(user.uid);
        });

      // Live subscription: auto-update session store whenever application status changes (e.g. approved)
      try {
        unsubApplication = onSnapshot(doc(firestore, 'driverApplications', user.uid), () => {
          if (!mounted) return;
          void resolveDriverSession(user.uid)
            .then((resolution) => {
              if (!mounted) return;
              storeDriverSessionResolution(resolution);
            })
            .catch(() => undefined);
        });
      } catch {
        // ignore
      }
    });

    return () => {
      mounted = false;
      unsubApplication?.();
      unsubscribe();
    };
  }, []);
}
