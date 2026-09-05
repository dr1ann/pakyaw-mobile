import { CancellationReasonInput } from '@pakyaw/shared/features/trip/components/CancellationReasonInput';
import { useState } from 'react';
/**
 * ArrivedSheet — Phase 8E passenger sheet.
 *
 * Shown when trip status is 'driver_arrived'. Tells the passenger
 * the driver is waiting at the pickup location.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, spacing, typography, radius } from '@/constants/theme';
import { useCancelTrip } from '@pakyaw/shared/features/trip/hooks/useTripActions';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';

export function ArrivedSheet() {
  const trip = useActiveTripStore((s) => s.trip);
  const { mutate: cancel, isPending } = useCancelTrip();

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
      <StatusPill label="Driver arrived" tone="success" dot />
      <Text style={styles.title}>Your driver has arrived</Text>
      <Text style={styles.subtitle}>
        Head to your pickup location. Your driver is waiting for you.
      </Text>
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
