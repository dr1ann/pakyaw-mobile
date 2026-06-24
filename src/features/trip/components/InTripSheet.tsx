/**
 * InTripSheet — Phase 8E passenger sheet.
 *
 * Shown when trip status is 'in_progress'. Indicates the ride is
 * actively underway.
 */

import { StyleSheet, Text, View } from 'react-native';

import { StatusPill } from '@/components/ui/StatusPill';
import { colors, spacing, typography } from '@/constants/theme';
import { useActiveTripStore } from '@/stores/activeTripStore';

export function InTripSheet() {
  const trip = useActiveTripStore((s) => s.trip);

  return (
    <View style={styles.container}>
      <StatusPill label="In progress" tone="info" dot />
      <Text style={styles.title}>Ride in progress</Text>
      <Text style={styles.subtitle}>
        You&apos;re on your way to{' '}
        {trip?.destination.label ?? 'your destination'}.
      </Text>
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
