import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  signInDriver,
} from '@pakyaw/shared/features/auth/services/auth.service';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { resolveAndStoreDriverSession } from '@/features/auth/services/driver-session.service';

export function useDriverSignIn() {
  const setSigningIn = useSessionStore((s) => s.setSigningIn);
  const queryClient = useQueryClient();

  const signInMutation = useMutation({
    mutationFn: async (args: { email: string; password: string }) => {
      // Gate the auth bootstrap listener while this mutation resolves the
      // Pakyaw account and application state after Firebase Auth succeeds.
      setSigningIn(true);
      const { uid } = await signInDriver(args.email, args.password);
      const resolution = await resolveAndStoreDriverSession(uid);
      return { uid, resolution };
    },
    onSuccess: ({ uid, resolution }) => {
      if (resolution.userDoc) queryClient.setQueryData(['profile', uid], resolution.userDoc);
    },
    onSettled: () => {
      setSigningIn(false);
    },
  });

  return { signInMutation };
}
