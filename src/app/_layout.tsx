import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useDriverSession, useDriverSessionStore } from '@/features/auth/stores/driver-session.store';
import {
  isDriverApplicationState,
  isDriverWorkspaceState,
} from '@/features/auth/services/driver-session.service';
import { useDriverSessionBootstrap } from '@/features/auth/hooks/useDriverSessionBootstrap';
import '@/features/driver-availability/services/backgroundLocationTask';
import { persistOptions, queryClient } from '@/services/query/queryClient';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
} from '@expo-google-fonts/montserrat';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export const unstable_settings = {
  '(auth)': { initialRouteName: 'index' },
  '(driver)': { initialRouteName: 'index' },
};

function AppNavigator() {
  useDriverSessionBootstrap();

  const { status } = useDriverSession();
  const isWorkspace = isDriverWorkspaceState(status);
  const isApplicationFlow = isDriverApplicationState(status) || isWorkspace;
  const isAccountState =
    status === 'authenticated_role_mismatch' ||
    status === 'account_suspended' ||
    status === 'account_blocked' ||
    status === 'driver_session_error';

  const onLayoutRootView = useCallback(async () => {
    try {
      await SplashScreen.hideAsync();
    } catch {
      // ignore
    }
  }, []);

  if (status === 'loading') return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === 'unauthenticated'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={status === 'authenticated_account_missing'}>
          <Stack.Screen name="account-setup-recovery" />
        </Stack.Protected>

        <Stack.Protected guard={isAccountState}>
          <Stack.Screen name="driver-account-state" />
        </Stack.Protected>

        <Stack.Protected guard={isApplicationFlow}>
          <Stack.Screen name="(driver)" />
        </Stack.Protected>
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [storesHydrated, setStoresHydrated] = useState(false);
  const [queryRestored, setQueryRestored] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  });

  useEffect(() => {
    // Monitor Zustand hydration
    const unsubSession = useSessionStore.persist.onFinishHydration(() => {
      checkZustandHydration();
    });
    const unsubTrip = useActiveTripStore.persist.onFinishHydration(() => {
      checkZustandHydration();
    });
    const unsubDriverSession = useDriverSessionStore.persist.onFinishHydration(() => {
      checkZustandHydration();
    });

    function checkZustandHydration() {
      if (
        useSessionStore.persist.hasHydrated() &&
        useActiveTripStore.persist.hasHydrated() &&
        useDriverSessionStore.persist.hasHydrated()
      ) {
        setStoresHydrated(true);
      }
    }

    // Check in case stores are already hydrated
    checkZustandHydration();

    return () => {
      unsubSession();
      unsubTrip();
      unsubDriverSession();
    };
  }, []);

  const isReady = storesHydrated && queryRestored && (fontsLoaded || fontError !== null);

  console.log('[DEBUG] storesHydrated:', storesHydrated, 'queryRestored:', queryRestored);
  console.log('[DEBUG] sessionHydrated:', useSessionStore.persist.hasHydrated(), 'activeTripHydrated:', useActiveTripStore.persist.hasHydrated());

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      onSuccess={() => {
        setTimeout(() => setQueryRestored(true), 0);
      }}
    >
      <SafeAreaProvider>
        {isReady ? <AppNavigator /> : null}
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}

