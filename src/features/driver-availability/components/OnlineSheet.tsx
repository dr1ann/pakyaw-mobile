/**
 * OnlineSheet — bottom sheet content rendered when driver is online.
 *
 * Shows the online status indicator and a Go Offline PowerButton.
 * Phase 7 will overlay IncomingRequestCard here when a nearby request arrives.
 *
 * Designed as a content component (not a Modal wrapper) so the map
 * remains visible beneath it in drive.tsx.
 */

import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';
import { PowerButton } from '@/features/driver-availability/components/PowerButton';
import type { Availability } from '@pakyaw/shared/types/driver';

type OnlineSheetProps = {
  availability: Availability;
  onPressGoOffline: () => void;
  goingOffline?: boolean;
  lastLatitude: number | null;
  lastLongitude: number | null;
};

export function OnlineSheet({
  availability,
  onPressGoOffline,
  goingOffline = false,
  lastLatitude,
  lastLongitude,
}: OnlineSheetProps) {
  const isOnTrip = availability === 'on_trip';

  return (
    <View style={styles.container}>
      {/* Status badge */}
      <View style={styles.statusRow}>
        <View style={[styles.dot, isOnTrip ? styles.dotTrip : styles.dotOnline]} />
        <Text
          style={[
            styles.statusLabel,
            isOnTrip ? styles.statusLabelTrip : styles.statusLabelOnline,
          ]}
        >
          {isOnTrip ? 'ON TRIP' : 'ONLINE'}
        </Text>
      </View>

      <Text style={styles.title}>
        {isOnTrip ? 'Trip in progress' : "You're on the road!"}
      </Text>
      <Text style={styles.subtitle}>
        {isOnTrip
          ? 'Complete your current trip to return to the online state.'
          : 'Waiting for nearby ride requests…'}
      </Text>

      {/* Last known location — placeholder map data */}
      {(lastLatitude !== null || lastLongitude !== null) && (
        <View style={styles.coordsCard}>
          <Text style={styles.coordsLabel}>CURRENT LOCATION</Text>
          <Text style={styles.coordsValue}>
            {lastLatitude?.toFixed(6) ?? '—'}, {lastLongitude?.toFixed(6) ?? '—'}
          </Text>
        </View>
      )}

      {/* Go Offline button — hidden while on a trip (Phase 7 teardown handles it) */}
      {!isOnTrip && (
        <PowerButton
          isOnline
          onPress={onPressGoOffline}
          loading={goingOffline}
        />
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: colors.green.primary,
  },
  dotTrip: {
    backgroundColor: colors.blue.primary,
  },
  statusLabel: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.label,
  },
  statusLabelOnline: {
    color: colors.green.primary,
  },
  statusLabelTrip: {
    color: colors.blue.primary,
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
  coordsCard: {
    backgroundColor: colors.surface.muted,
    borderRadius: 10,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  coordsLabel: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    color: colors.ink[400],
    letterSpacing: typography.letterSpacing.label,
    marginBottom: 2,
  },
  coordsValue: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    fontWeight: typography.weight.medium,
  },
});
