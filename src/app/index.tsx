import { Redirect } from 'expo-router';

import { useSessionStore } from '@/stores/sessionStore';

export default function IndexScreen() {
  const onboardingSeen = useSessionStore((s) => s.onboardingSeen);
  return <Redirect href={onboardingSeen ? '/welcome' : '/onboarding'} />;
}
