import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useSession, useSessionBootstrap } from '@/features/auth/hooks/useSession';
import '@/features/driver-availability/services/backgroundLocationTask';
import { persistOptions, queryClient } from '@/services/query/queryClient';
import { useActiveTripStore } from '@/stores/activeTripStore';
import { useSessionStore } from '@/stores/sessionStore';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export const unstable_settings = {
  '(auth)': { initialRouteName: 'index' },
  '(passenger)': { initialRouteName: 'index' },
  '(driver)': { initialRouteName: 'index' },
};

function AppNavigator() {
  useSessionBootstrap();

  const { status, role } = useSession();
  const authed = status === 'authenticated';

  const onLayoutRootView = useCallback(async () => {
    if (status !== 'loading') {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        // ignore
      }
    }
  }, [status]);

  if (status === 'loading') return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
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
    </View>
  );
}

export default function RootLayout() {
  const [storesHydrated, setStoresHydrated] = useState(false);
  const [queryRestored, setQueryRestored] = useState(false);

  useEffect(() => {
    // Monitor Zustand hydration
    const unsubSession = useSessionStore.persist.onFinishHydration(() => {
      checkZustandHydration();
    });
    const unsubTrip = useActiveTripStore.persist.onFinishHydration(() => {
      checkZustandHydration();
    });

    function checkZustandHydration() {
      if (
        useSessionStore.persist.hasHydrated() &&
        useActiveTripStore.persist.hasHydrated()
      ) {
        setStoresHydrated(true);
      }
    }

    // Check in case stores are already hydrated
    checkZustandHydration();

    return () => {
      unsubSession();
      unsubTrip();
    };
  }, []);

  const isReady = storesHydrated && queryRestored;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      onSuccess={() => setQueryRestored(true)}
    >
      <SafeAreaProvider>
        {isReady ? <AppNavigator /> : null}
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}

