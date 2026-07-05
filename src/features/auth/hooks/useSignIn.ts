/**
 * useSignIn.ts
 *
 * Passenger sign-in hook — email + password.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { AuthError } from '@pakyaw/shared/features/auth/errors';
import {
  getUserDoc,
  signInPassenger,
  signOutUser,
} from '@pakyaw/shared/features/auth/services/auth.service';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

export function useSignIn() {
  const setSession = useSessionStore((s) => s.setSession);
  const setSigningIn = useSessionStore((s) => s.setSigningIn);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: { email: string; password: string }) => {
      // Gate the auth bootstrap listener so it doesn't race ahead and route
      // the user to the dashboard before role validation completes.
      setSigningIn(true);
      const uid = await signInPassenger(args.email, args.password);
      // Fetch the role doc so we can route correctly. If anything fails here
      // we must sign the Firebase user back out — otherwise onAuthStateChanged
      // will fire and route them with the wrong role.
      try {
        const userDoc = await getUserDoc(uid);
        if (!userDoc) {
          throw new AuthError(
            'Account not found. Please sign up or contact support.',
          );
        }
        if (userDoc.role !== 'passenger') {
          throw new AuthError('Use the driver sign-in screen to access your account.');
        }
        return { uid, userDoc };
      } catch (err) {
        await signOutUser().catch(() => undefined);
        throw err;
      }
    },
    onSuccess: ({ uid, userDoc }) => {
      queryClient.setQueryData(['profile', uid], userDoc);
      setSession(uid, 'passenger');
    },
    onSettled: () => {
      setSigningIn(false);
    },
  });
}
