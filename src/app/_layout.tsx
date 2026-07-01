import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/features/driver-availability/services/backgroundLocationTask';
import { useSession, useSessionBootstrap } from '@/features/auth/hooks/useSession';
import { queryClient } from '@/services/query/queryClient';

function AppNavigator() {
  // Bootstrap the Firebase auth listener — this must be inside the
  // QueryClientProvider so useQueryClient() resolves correctly.
  useSessionBootstrap();

  const { status, role } = useSession();
  const authed = status === 'authenticated';

  // Keep splash up while auth state is resolving (architecture.md §6.1).
  if (status === 'loading') return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!authed}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={authed && role === 'passenger'}>
        <Stack.Screen name="(passenger)" />
      </Stack.Protected>

      <Stack.Protected guard={authed && role === 'driver'}>
        <Stack.Screen name="(driver)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
