/**
 * CancelledSheet — Phase 8E passenger/driver sheet.
 *
 * Shown when trip status is 'cancelled'. Tells the user who cancelled
 * and the reason.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors, spacing, typography } from '@/constants/theme';
import { useActiveTripStore } from '@/stores/activeTripStore';

type CancelledSheetProps = {
  onDismiss: () => void;
};

export function CancelledSheet({ onDismiss }: CancelledSheetProps) {
  const trip = useActiveTripStore((s) => s.trip);

  const cancelledBy = trip?.cancelledBy ?? 'unknown';
  const reason = trip?.cancelReason ?? 'No reason provided.';

  return (
    <View style={styles.container}>
      <StatusPill label="Cancelled" tone="danger" dot />
      <Text style={styles.title}>Trip cancelled</Text>
      <Text style={styles.subtitle}>
        This trip was cancelled by the {cancelledBy}.
      </Text>
      {reason ? <Text style={styles.reason}>{reason}</Text> : null}
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
  reason: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[400],
    fontStyle: 'italic',
  },
});
