/**
 * useSignOut.ts
 *
 * Signs the current user out:
 * 1. Calls Firebase signOut
 * 2. Clears sessionStore (triggers navigation guards → (auth))
 * 3. Clears TanStack Query cache for user-scoped data
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { signOutUser } from '@/features/auth/services/auth.service';
import { useSessionStore } from '@/stores/sessionStore';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { logger } from '@/lib/logger';

export function useSignOut() {
  const clear = useSessionStore((s) => s.clear);
  const uid = useSessionStore((s) => s.uid);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signOutUser,
    onSuccess: () => {
      // Remove cached user data for the signed-out uid.
      if (uid) {
        queryClient.removeQueries({ queryKey: ['profile', uid] });
        queryClient.removeQueries({ queryKey: ['history', uid] });
        queryClient.removeQueries({ queryKey: ['savedPlaces', uid] });
      }
      // Drop the coordinate-keyed route cache so a prior session's route is
      // never replayed into a fresh booking draft.
      queryClient.removeQueries({ queryKey: ['route'] });
      // Clear booking draft (session-scoped per §6.2, §8)
      useBookingDraftStore.getState().reset();
      // Flip session store — this is what drives the navigation guard.
      clear();
    },
    onError: (err) => {
      logger.error('[useSignOut] sign-out error:', err);
      // Clear local state even if Firebase sign-out fails so the user
      // is not stuck in an authenticated state with a broken session.
      useBookingDraftStore.getState().reset();
      clear();
    },
  });
}
