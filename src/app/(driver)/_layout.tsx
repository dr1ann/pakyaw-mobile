import { Redirect, Slot, Tabs, useSegments } from 'expo-router';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors } from '../../constants/theme';
import { useDriverSession } from '@/features/auth/stores/driver-session.store';
import { isDriverWorkspaceState } from '@/features/auth/services/driver-session.service';

export const unstable_settings = { initialRouteName: 'index' };

export default function DriverLayout() {
  const { status } = useDriverSession();
  const segments = useSegments();
  const isWorkspace = isDriverWorkspaceState(status);
  const isGatedRoute = segments[segments.length - 1] === 'application'
    || segments[segments.length - 1] === 'support';

  // The root guard allows the application/status routes to live in this
  // group, but the operational tabs must never mount until approval is known.
  if (!isWorkspace) {
    if (!isGatedRoute) return <Redirect href="/(driver)/application" />;
    return <Slot />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green.primary,
        tabBarInactiveTintColor: colors.ink[400],
        tabBarStyle: {
          backgroundColor: colors.surface.card,
          borderTopColor: colors.border.subtle,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolIcon name={focused ? 'car.fill' : 'car'} size={size} tintColor={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'My Trips',
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolIcon name={focused ? 'clock.fill' : 'clock'} size={size} tintColor={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips/[tripId]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolIcon name={focused ? 'banknote.fill' : 'banknote'} size={size} tintColor={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: 'Trip Reports',
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolIcon name={focused ? 'doc.text.fill' : 'doc.text'} size={size} tintColor={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolIcon name={focused ? 'person.fill' : 'person'} size={size} tintColor={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="application"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
