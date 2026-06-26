import { Tabs } from 'expo-router';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { colors } from '../../constants/theme';

export default function PassengerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue.primary,
        tabBarInactiveTintColor: colors.ink[400],
        tabBarStyle: {
          backgroundColor: colors.surface.card,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="ride"
        options={{
          title: 'Ride',
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolIcon name={focused ? 'car.fill' : 'car'} size={size} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolIcon name={focused ? 'clock.fill' : 'clock'} size={size} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity/[tripId]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolIcon name={focused ? 'person.fill' : 'person'} size={size} tintColor={color} />
          ),
        }}
      />
    </Tabs>
  );
}
