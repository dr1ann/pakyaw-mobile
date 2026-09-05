import { CancellationReasonInput } from '@pakyaw/shared/features/trip/components/CancellationReasonInput';
import { useState } from 'react';
/**
 * EnRouteSheet — Phase 8E passenger sheet.
 *
 * Shown when trip status is 'driver_arriving'. Displays the driver's
 * live approach status. No action buttons for the passenger.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, spacing, typography, radius } from '@/constants/theme';
import { useCancelTrip } from '@pakyaw/shared/features/trip/hooks/useTripActions';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';

export function EnRouteSheet() {
  const trip = useActiveTripStore((s) => s.trip);
  const driverLocation = useActiveTripStore((s) => s.driverLocation);
  const { mutate: cancel, isPending } = useCancelTrip();
  const displayDistanceMeters =
    trip?.tripProgress?.remainingMeters ?? trip?.driverRoute?.distanceMeters ?? null;
  const displayEtaSeconds =
    trip?.tripProgress?.etaSeconds ?? trip?.driverRoute?.durationSeconds ?? null;

  const [cancelReason, setCancelReason] = useState('');

  function handleCancel() {
    if (!cancelReason.trim() || isPending) return;
    if (trip) {
      cancel({
        tripId: trip.id,
        by: 'passenger',
        reason: cancelReason.trim(),
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
      <View style={styles.privacyNoticeCard}>
        <SymbolIcon
          name={trip?.bookingFor === 'other' ? 'person.2.fill' : 'location.fill'}
          size={14}
          tintColor={colors.blue.primary}
        />
        <Text style={styles.privacyNoticeText}>
          {trip?.bookingFor === 'other'
            ? "Because this ride is for someone else, your location won't be shared with the Driver."
            : 'Your live location is temporarily shared with your assigned Driver until pickup to help them find you.'}
        </Text>
      </View>
      <CancellationReasonInput value={cancelReason} onChangeText={setCancelReason} disabled={isPending} />
      <Button
        label="Cancel ride"
        onPress={handleCancel}
        loading={isPending}
        disabled={isPending || !cancelReason.trim()}
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
  privacyNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.blue.tint,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  privacyNoticeText: {
    flex: 1,
    fontSize: typography.size.label,
    fontWeight: typography.weight.medium,
    color: colors.blue.primary,
    lineHeight: 16,
  },
});
