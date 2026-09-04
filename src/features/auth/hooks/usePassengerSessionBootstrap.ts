import { useEffect } from 'react';
import { auth, onAuthStateChanged, signOut, type User } from '@/services/firebase/firebase';
import { logger } from '@pakyaw/shared/lib/logger';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { usePassengerSessionStore } from '@/features/auth/stores/passenger-session.store';
import {
  resolvePassengerSession,
  storePassengerSessionResolution,
} from '@/features/auth/services/passenger-session.service';

export function usePassengerSessionBootstrap(): void {
  useEffect(() => {
    let mounted = true;
    let resolutionGeneration = 0;

    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      const generation = ++resolutionGeneration;

      if (useSessionStore.getState().signingIn) return;

      if (!user) {
        usePassengerSessionStore.getState().clear();
        useSessionStore.getState().clear();
        return;
      }

      usePassengerSessionStore.getState().beginResolving(user.uid);
      void resolvePassengerSession(user.uid)
        .then((resolution) => {
          if (!mounted || generation !== resolutionGeneration) return;
          if (resolution.status === 'invalid_role' || resolution.status === 'needs_recovery') {
            signOut(auth).catch(() => undefined);
            usePassengerSessionStore.getState().clear();
            useSessionStore.getState().clear();
            return;
          }
          storePassengerSessionResolution(resolution);
        })
        .catch((error: unknown) => {
          if (!mounted || generation !== resolutionGeneration) return;
          logger.error('[Passenger Session] resolution failed', error);
          useSessionStore.getState().clear();
          usePassengerSessionStore.getState().setError(user.uid, 'Failed to resolve session.');
        });
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
}
