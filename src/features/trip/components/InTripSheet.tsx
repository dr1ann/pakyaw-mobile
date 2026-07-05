/**
 * InTripSheet — Phase 8E passenger sheet.
 *
 * Shown when trip status is 'in_progress'. Indicates the ride is
 * actively underway.
 */

import { StyleSheet, Text, View } from 'react-native';

import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { colors, spacing, typography } from '@/constants/theme';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';

export function InTripSheet({
  remainingDistanceMeters,
  etaSeconds,
}: {
  readonly remainingDistanceMeters?: number | null;
  readonly etaSeconds?: number | null;
}) {
  const trip = useActiveTripStore((s) => s.trip);

  const displayDistanceMeters =
    remainingDistanceMeters ?? trip?.tripProgress?.remainingMeters ?? trip?.route?.distanceMeters ?? null;
  const displayEtaSeconds =
    etaSeconds ?? trip?.tripProgress?.etaSeconds ?? trip?.route?.durationSeconds ?? null;

  const distanceKm = displayDistanceMeters != null
    ? (displayDistanceMeters / 1000).toFixed(1)
    : null;
  const etaMinutes = displayEtaSeconds != null
    ? Math.max(1, Math.round(displayEtaSeconds / 60))
    : null;

  return (
    <View style={styles.container}>
      <StatusPill label="In progress" tone="info" dot />
      <Text style={styles.title}>Ride in progress</Text>
      <Text style={styles.subtitle}>
        You&apos;re on your way to{' '}
        {trip?.destination.label ?? 'your destination'}.
      </Text>

      {displayDistanceMeters != null && (
        <View style={styles.etaCard}>
          <View style={styles.etaRow}>
            <Text style={styles.etaLabel}>TRIP DISTANCE</Text>
            <Text style={styles.etaValue}>{distanceKm} km</Text>
          </View>
          <View style={styles.etaRow}>
            <Text style={styles.etaLabel}>ESTIMATED TIME</Text>
            <Text style={styles.etaValue}>{etaMinutes} min</Text>
          </View>
        </View>
      )}
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
    marginVertical: spacing[2],
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
});
