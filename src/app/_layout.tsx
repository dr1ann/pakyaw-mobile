import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { persistOptions, queryClient } from '@/services/query/queryClient';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { usePassengerSessionStore } from '@/features/auth/stores/passenger-session.store';
import { usePassengerSessionBootstrap } from '@/features/auth/hooks/usePassengerSessionBootstrap';
import { signOutUser } from '@pakyaw/shared/features/auth/services/auth.service';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export const unstable_settings = {
  '(auth)': { initialRouteName: 'index' },
  '(passenger)': { initialRouteName: 'index' },
};

function AppNavigator() {
  usePassengerSessionBootstrap();

  const sessionStatus = usePassengerSessionStore((s) => s.status);
  const baseStatus = useSessionStore((s) => s.status);
  const baseRole = useSessionStore((s) => s.role);

  const isActivePassenger = sessionStatus === 'active' && baseRole === 'passenger';
  const isNeedsRecovery = sessionStatus === 'needs_recovery';
  const isAccountState = sessionStatus === 'suspended' || sessionStatus === 'blocked';
  const isAuthStack = sessionStatus === 'unauthenticated' || sessionStatus === 'idle' || baseStatus === 'unauthenticated';

  useEffect(() => {
    if (baseStatus === 'authenticated' && baseRole !== 'passenger') {
      console.log('[DEBUG] Non-passenger user authenticated on passenger app. Signing out...');
      signOutUser().catch((err) => console.error('Auto-signout failed:', err));
      useSessionStore.getState().clear();
      usePassengerSessionStore.getState().clear();
    }
  }, [baseStatus, baseRole]);

  const onLayoutRootView = useCallback(async () => {
    if (sessionStatus !== 'resolving') {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // ignore
      }
    }
  }, [sessionStatus]);

  if (sessionStatus === 'resolving') return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isAuthStack}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={isActivePassenger}>
          <Stack.Screen name="(passenger)" />
        </Stack.Protected>

        <Stack.Protected guard={isNeedsRecovery}>
          <Stack.Screen name="account-setup-recovery" />
        </Stack.Protected>

        <Stack.Protected guard={isAccountState}>
          <Stack.Screen name="passenger-account-state" />
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
