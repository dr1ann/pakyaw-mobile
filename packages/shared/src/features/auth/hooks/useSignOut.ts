/**
 * useSignOut.ts
 *
 * Signs the current user out:
 * 1. Calls Firebase signOut
 * 2. Clears sessionStore (triggers navigation guards → (auth))
 * 3. Clears TanStack Query cache for user-scoped data
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { signOutUser } from '@pakyaw/shared/features/auth/services/auth.service';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { logger } from '@pakyaw/shared/lib/logger';

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
      }
      // Flip session store — this is what drives the navigation guard.
      clear();
    },
    onError: (err) => {
      logger.error('[useSignOut] sign-out error:', err);
      // Clear local state even if Firebase sign-out fails so the user
      // is not stuck in an authenticated state with a broken session.
      clear();
    },
  });
}
