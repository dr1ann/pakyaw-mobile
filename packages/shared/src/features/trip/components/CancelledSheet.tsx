/**
 * CancelledSheet — Phase 17 Failure UX refinement.
 *
 * Shown when trip status is 'cancelled'. Explains clearly what happened
 * and provides a clear path back to the map / new booking.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@pakyaw/shared/components/ui/Button';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { formatCancellationReason } from '../cancellationReasons';

type CancelledSheetProps = {
  onDismiss: () => void;
};

export function CancelledSheet({ onDismiss }: CancelledSheetProps) {
  const trip = useActiveTripStore((s) => s.trip);

  const cancelledBy: string = (trip?.cancelledBy as string | undefined) ?? 'unknown';
  const reason = formatCancellationReason(trip?.cancelReason);

  const explanation =
    cancelledBy === 'driver'
      ? 'Your driver had to cancel this ride.'
      : cancelledBy === 'passenger'
      ? 'You cancelled this ride.'
      : cancelledBy === 'system'
      ? 'This trip was automatically cancelled by the system.'
      : 'This trip is no longer active.';

  return (
    <View style={styles.container} testID="trip-cancelled-sheet">
      <StatusPill label="Cancelled" tone="danger" dot />
      <Text style={styles.title}>Trip Cancelled</Text>
      <Text style={styles.subtitle}>{explanation}</Text>
      {reason ? (
        <View style={styles.reasonCard}>
          <Text style={styles.reasonLabel}>Reason given:</Text>
          <Text style={styles.reasonText}>"{reason}"</Text>
        </View>
      ) : null}
      <Button
        label="Return to Map"
        onPress={onDismiss}
        style={styles.doneBtn}
        testID="cancelled-sheet-done-btn"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
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
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    lineHeight: typography.lineHeight.body,
  },
  reasonCard: {
    backgroundColor: colors.surface.muted,
    padding: spacing[3],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 2,
  },
  reasonLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.ink[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[900],
    fontStyle: 'italic',
  },
  doneBtn: {
    minHeight: 48,
    marginTop: spacing[2],
  },
});
