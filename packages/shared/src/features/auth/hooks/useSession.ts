/**
 * useSession.ts
 *
 * Subscribes to Firebase Auth's onAuthStateChanged, fetches the user's
 * Firestore role doc via TanStack Query, and populates sessionStore.
 *
 * Lifecycle:
 *   mount → setStatus('loading')
 *   onAuthStateChanged fires:
 *     - no user  → clear() → status = 'unauthenticated'
 *     - user     → fetch users/{uid} → setSession(uid, role) → status = 'authenticated'
 *
 * This hook must be called once at the root layout so the auth listener
 * is active for the lifetime of the app.
 */

import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';

import { firebaseAuth, getUserDoc } from '@pakyaw/shared/features/auth/services/auth.service';
import { logger } from '@pakyaw/shared/lib/logger';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

export function useSessionBootstrap(): void {
  const setSession = useSessionStore((s) => s.setSession);
  const clear = useSessionStore((s) => s.clear);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      // While a sign-in mutation is mid-flight (e.g. driver role/approval
      // check still running), skip this listener — the mutation drives session
      // state itself via setSession/clear. Otherwise we race the mutation and
      // briefly flip Stack.Protected to the dashboard before bouncing back.
      if (useSessionStore.getState().signingIn) {
        return;
      }

      if (!user) {
        clear();
        return;
      }

      try {
        // Check the TanStack Query cache first so cold start with cached
        // profile data doesn't require an extra round-trip.
        const cached = queryClient.getQueryData<{ role: string }>([
          'profile',
          user.uid,
        ]);
        if (cached?.role === 'passenger' || cached?.role === 'driver') {
          setSession(user.uid, cached.role as 'passenger' | 'driver');
          return;
        }

        // Fetch from Firestore and cache the result.
        const userDoc = await getUserDoc(user.uid);
        if (!userDoc) {
          // Auth user exists but no Firestore doc — treat as unauthenticated.
          logger.warn('[useSession] no users/{uid} doc for', user.uid);
          clear();
          return;
        }

        queryClient.setQueryData(['profile', user.uid], userDoc);
        setSession(user.uid, userDoc.role);
      } catch (err) {
        logger.error('[useSession] error fetching profile:', err);
        // On error, leave the user unauthenticated rather than crashing.
        clear();
      }
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Returns the current session status and role.
 * Use this in components to read session state.
 */
export function useSession() {
  const status = useSessionStore((s) => s.status);
  const role = useSessionStore((s) => s.role);
  const uid = useSessionStore((s) => s.uid);
  return { status, role, uid };
}
