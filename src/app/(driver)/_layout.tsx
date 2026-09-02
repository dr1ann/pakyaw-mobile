import { Redirect, Slot, Tabs, useSegments } from 'expo-router';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors } from '../../constants/theme';
import { useAvailabilityStore } from '../../stores/availabilityStore';
import { useDriverSession } from '@/features/auth/stores/driver-session.store';
import { isDriverWorkspaceState } from '@/features/auth/services/driver-session.service';

export const unstable_settings = { initialRouteName: 'index' };

export default function DriverLayout() {
  const { status } = useDriverSession();
  const segments = useSegments();
  const availability = useAvailabilityStore((s) => s.availability);
  const isFullScreenDriverMode = availability !== 'offline';
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
        tabBarStyle: isFullScreenDriverMode
          ? { display: 'none' }
          : {
              backgroundColor: colors.surface.card,
              borderTopColor: colors.border.subtle,
            },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Drive',
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolIcon name={focused ? 'car.fill' : 'car'} size={size} tintColor={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolIcon name={focused ? 'person.fill' : 'person'} size={size} tintColor={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
