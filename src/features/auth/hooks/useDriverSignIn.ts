import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  getUserDoc,
  signInDriver,
} from '@/features/auth/services/auth.service';
import { useSessionStore } from '@/stores/sessionStore';

export function useDriverSignIn() {
  const setSession = useSessionStore((s) => s.setSession);
  const setSigningIn = useSessionStore((s) => s.setSigningIn);
  const queryClient = useQueryClient();

  const signInMutation = useMutation({
    mutationFn: async (args: { email: string; password: string }) => {
      // Gate the auth bootstrap listener so it doesn't race ahead during the
      // role/approval check — and again when signInDriver calls signOut on
      // failure, which would otherwise fire onAuthStateChanged with null.
      setSigningIn(true);
      const { uid } = await signInDriver(args.email, args.password);
      const userDoc = await getUserDoc(uid);
      return { uid, userDoc };
    },
    onSuccess: ({ uid, userDoc }) => {
      if (userDoc) queryClient.setQueryData(['profile', uid], userDoc);
      setSession(uid, 'driver');
    },
    onSettled: () => {
      setSigningIn(false);
    },
  });

  return { signInMutation };
}
