/**
 * CompletedSheet — Phase 8E passenger/driver sheet.
 *
 * Shown when trip status is 'completed'. Confirms the ride finished
 * successfully.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { colors, spacing, typography } from '@/constants/theme';

type CompletedSheetProps = {
  onDismiss: () => void;
};

import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';

export function CompletedSheet({ onDismiss }: CompletedSheetProps) {
  const trip = useActiveTripStore((s: any) => s.trip);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <StatusPill label="Completed" tone="success" dot />
        <Text style={styles.tripId}>Trip #{trip?.id.slice(-6).toUpperCase() ?? '------'}</Text>
      </View>

      <Text style={styles.title}>Digital Receipt</Text>
      <Text style={styles.subtitle}>
        Thank you for riding with Pakyaw! Here are the details of your completed trip.
      </Text>

      {/* Receipt Card */}
      <View style={styles.receiptCard}>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>Total Fare</Text>
          <Text style={styles.receiptTotal}>
            ₱{trip?.fare?.toFixed(2) ?? '0.00'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>Pickup</Text>
          <Text style={styles.receiptValue} numberOfLines={1}>
            {trip?.pickup?.label ?? 'N/A'}
          </Text>
        </View>

        <View style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>Destination</Text>
          <Text style={styles.receiptValue} numberOfLines={1}>
            {trip?.destination?.label ?? 'N/A'}
          </Text>
        </View>

        <View style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>Passengers</Text>
          <Text style={styles.receiptValue}>
            {trip?.passengerCount ?? 1} {trip?.passengerCount === 1 ? 'person' : 'people'}
          </Text>
        </View>
      </View>

      <Button label="Done" onPress={onDismiss} />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  tripId: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[400],
    letterSpacing: 1,
  },
  receiptCard: {
    backgroundColor: colors.surface.muted,
    borderRadius: 16,
    padding: spacing[4],
    gap: spacing[3],
    marginTop: spacing[2],
    marginBottom: spacing[4],
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[4],
  },
  receiptLabel: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[500],
    flex: 1,
  },
  receiptValue: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    flex: 2,
    textAlign: 'right',
  },
  receiptTotal: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing[1],
  },
});
