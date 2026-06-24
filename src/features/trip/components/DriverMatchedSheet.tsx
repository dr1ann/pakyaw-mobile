/**
 * DriverMatchedSheet — Phase 8E passenger sheet.
 *
 * Shown when trip status is 'accepted'. Displays the driver match
 * confirmation. No transition buttons on the passenger side.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors, spacing, typography } from '@/constants/theme';
import { useCancelTrip } from '@/features/trip/hooks/useTripActions';
import { useActiveTripStore } from '@/stores/activeTripStore';

export function DriverMatchedSheet() {
  const trip = useActiveTripStore((s) => s.trip);
  const { mutate: cancel, isPending } = useCancelTrip();

  function handleCancel() {
    if (trip) {
      cancel({
        tripId: trip.id,
        by: 'passenger',
        reason: 'Passenger cancelled the ride after matching',
      });
    }
  }

  return (
    <View style={styles.container}>
      <StatusPill label="Driver matched" tone="success" dot />
      <Text style={styles.title}>Your driver is on the way</Text>
      <Text style={styles.subtitle}>
        A driver has accepted your ride and will begin heading to your pickup
        location shortly.
      </Text>
      <Button
        label="Cancel ride"
        onPress={handleCancel}
        loading={isPending}
        disabled={isPending}
        tone="destructive"
        testID="passenger-cancel-matched"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    gap: spacing[3],
  },
  title: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: typography.size.body,
    color: colors.ink[500],
    lineHeight: typography.lineHeight.body,
  },
});
