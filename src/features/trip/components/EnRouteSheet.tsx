/**
 * EnRouteSheet — Phase 8E passenger sheet.
 *
 * Shown when trip status is 'driver_arriving'. Displays the driver's
 * live approach status. No action buttons for the passenger.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors, spacing, typography } from '@/constants/theme';
import { useCancelTrip } from '@/features/trip/hooks/useTripActions';
import { useActiveTripStore } from '@/stores/activeTripStore';

export function EnRouteSheet() {
  const trip = useActiveTripStore((s) => s.trip);
  const driverLocation = useActiveTripStore((s) => s.driverLocation);
  const { mutate: cancel, isPending } = useCancelTrip();
  const displayDistanceMeters =
    trip?.tripProgress?.remainingMeters ?? trip?.driverRoute?.distanceMeters ?? null;
  const displayEtaSeconds =
    trip?.tripProgress?.etaSeconds ?? trip?.driverRoute?.durationSeconds ?? null;

  function handleCancel() {
    if (trip) {
      cancel({
        tripId: trip.id,
        by: 'passenger',
        reason: 'Passenger cancelled the ride while driver was en route',
      });
    }
  }

  return (
    <View style={styles.container}>
      <StatusPill label="En route" tone="info" dot />
      <Text style={styles.title}>Driver is heading to you</Text>
      <Text style={styles.subtitle}>
        Your driver is on the way to your pickup location.
      </Text>
      {displayDistanceMeters != null && displayEtaSeconds != null ? (
        <View style={styles.etaCard}>
          <View style={styles.etaRow}>
            <Text style={styles.etaLabel}>DISTANCE TO YOU</Text>
            <Text style={styles.etaValue}>
              {(displayDistanceMeters / 1000).toFixed(1)} km
            </Text>
          </View>
          <View style={styles.etaRow}>
            <Text style={styles.etaLabel}>ETA</Text>
            <Text style={styles.etaValue}>
              {Math.max(1, Math.round(displayEtaSeconds / 60))} min
            </Text>
          </View>
        </View>
      ) : (
        driverLocation != null && (
          <View style={styles.etaCard}>
            <Text style={styles.calculatingText}>Calculating ETA...</Text>
          </View>
        )
      )}
      <Button
        label="Cancel ride"
        onPress={handleCancel}
        loading={isPending}
        disabled={isPending}
        tone="destructive"
        testID="passenger-cancel-enroute"
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
  etaCard: {
    backgroundColor: colors.surface.muted,
    borderRadius: 10,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  etaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  etaLabel: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    color: colors.ink[400],
    letterSpacing: typography.letterSpacing.label,
  },
  etaValue: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[900],
    fontWeight: typography.weight.bold,
  },
  calculatingText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    fontWeight: typography.weight.medium,
    textAlign: 'center',
  },
});
