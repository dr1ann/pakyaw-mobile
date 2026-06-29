import { Tabs } from 'expo-router';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { colors } from '../../constants/theme';
import { useAvailabilityStore } from '../../stores/availabilityStore';

export default function DriverLayout() {
  const availability = useAvailabilityStore((s) => s.availability);
  const isFullScreenDriverMode = availability !== 'offline';

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
        name="drive"
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
