/**
 * ArrivedSheet — Phase 8E passenger sheet.
 *
 * Shown when trip status is 'driver_arrived'. Tells the passenger
 * the driver is waiting at the pickup location.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { colors, spacing, typography } from '@/constants/theme';
import { useCancelTrip } from '@pakyaw/shared/features/trip/hooks/useTripActions';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';

export function ArrivedSheet() {
  const trip = useActiveTripStore((s) => s.trip);
  const { mutate: cancel, isPending } = useCancelTrip();

  function handleCancel() {
    if (trip) {
      cancel({
        tripId: trip.id,
        by: 'passenger',
        reason: 'Passenger cancelled the ride after driver arrived',
      });
    }
  }

  return (
    <View style={styles.container}>
      <StatusPill label="Driver arrived" tone="success" dot />
      <Text style={styles.title}>Your driver has arrived</Text>
      <Text style={styles.subtitle}>
        Head to your pickup location. Your driver is waiting for you.
      </Text>
      <Button
        label="Cancel ride"
        onPress={handleCancel}
        loading={isPending}
        disabled={isPending}
        tone="destructive"
        testID="passenger-cancel-arrived"
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
