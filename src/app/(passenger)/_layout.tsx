import { Tabs } from 'expo-router';

export default function PassengerLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="ride" options={{ title: 'Ride' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen
        name="activity/[tripId]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
