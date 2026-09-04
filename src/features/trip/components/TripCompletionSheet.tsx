import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { RouteConnector } from '@pakyaw/shared/components/ui/RouteConnector';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import type { TripDoc } from '@pakyaw/shared/features/trip/types';
import { colors, spacing, typography } from '@/constants/theme';
import {
  formatPeso,
  formatTripDateTime,
  passengerRideModeLabel,
} from '@/features/trip-history/presentation';

export type TripCompletionSheetProps = {
  readonly trip: TripDoc;
  readonly onDone: () => void;
  readonly onViewActivity: () => void;
};

export function TripCompletionSheet({ trip, onDone, onViewActivity }: TripCompletionSheetProps) {
  // Read the server snapshot only. fareBreakdown.total is canonical on newer
  // trips; the numeric fare projection keeps legacy completed rides readable.
  const fare = formatPeso(
    typeof trip.fareBreakdown?.total === 'number' ? trip.fareBreakdown.total : trip.fare,
  );
  const completedAt = formatTripDateTime(trip.completedAt ?? trip.requestedAt);
  const timestampLabel = trip.completedAt ? 'Completed' : trip.requestedAt ? 'Requested' : null;
  const driverName = trip.driverPublic?.displayName;
  const vehicle = trip.driverPublic?.vehicle;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      accessibilityLabel="Trip completed"
    >
      <View style={styles.statusRow}>
        <View style={styles.checkHalo}>
          <SymbolIcon name="checkmark" size={18} tintColor={colors.success} />
        </View>
        <StatusPill label="Completed" tone="success" dot />
      </View>

      <Text style={styles.title}>Trip completed</Text>
      <Text style={styles.subtitle}>
        Your ride details are saved in Activity.
      </Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.mode}>{passengerRideModeLabel(trip.mode)}</Text>
            {completedAt ? (
              <Text style={styles.timestamp}>
                {timestampLabel ? `${timestampLabel} ${completedAt}` : completedAt}
              </Text>
            ) : null}
          </View>
          {fare ? (
            <View style={styles.fareGroup} accessibilityLabel={`Trip fare ${fare}`}>
              <Text style={styles.fareLabel}>TRIP FARE</Text>
              <Text style={styles.fare}>{fare}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.routeRow}>
          <RouteConnector height={60} />
          <View style={styles.routeText}>
            <View>
              <Text style={styles.locationLabel}>PICKUP</Text>
              <Text style={styles.locationValue} numberOfLines={2}>{trip.pickup.label}</Text>
            </View>
            <View>
              <Text style={styles.locationLabel}>DESTINATION</Text>
              <Text style={styles.locationValue} numberOfLines={2}>{trip.destination.label}</Text>
            </View>
          </View>
        </View>

        {driverName ? (
          <View style={styles.driverRow}>
            <Text style={styles.driverLabel}>Driver</Text>
            <Text style={styles.driverValue} numberOfLines={1}>
              {driverName}{vehicle?.plateNumber ? ` · ${vehicle.plateNumber}` : ''}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button label="View Activity" onPress={onViewActivity} />
        <Button label="Done" variant="ghost" onPress={onDone} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: '78%',
  },
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[6],
    gap: spacing[3],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  checkHalo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.green.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.ink[900],
    fontSize: typography.size.h2,
    fontFamily: typography.family.extraBold,
  },
  subtitle: {
    color: colors.ink[500],
    fontSize: typography.size.body,
    fontFamily: typography.family.regular,
    lineHeight: typography.lineHeight.body,
  },
  summaryCard: {
    backgroundColor: colors.surface.muted,
    borderRadius: 16,
    padding: spacing[4],
    gap: spacing[4],
    marginTop: spacing[1],
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  mode: {
    color: colors.ink[900],
    fontSize: typography.size.bodyMd,
    fontFamily: typography.family.bold,
  },
  timestamp: {
    color: colors.ink[500],
    fontSize: typography.size.caption,
    fontFamily: typography.family.medium,
    marginTop: 2,
  },
  fareGroup: {
    alignItems: 'flex-end',
  },
  fareLabel: {
    color: colors.ink[500],
    fontSize: typography.size.label,
    fontFamily: typography.family.bold,
    letterSpacing: typography.letterSpacing.label,
  },
  fare: {
    color: colors.blue.primary,
    fontSize: typography.size.h3,
    fontFamily: typography.family.extraBold,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing[3],
  },
  routeText: {
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  locationLabel: {
    color: colors.ink[400],
    fontSize: typography.size.label,
    fontFamily: typography.family.bold,
    letterSpacing: typography.letterSpacing.label,
  },
  locationValue: {
    color: colors.ink[900],
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.semibold,
    marginTop: 2,
  },
  driverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing[3],
  },
  driverLabel: {
    color: colors.ink[500],
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.medium,
  },
  driverValue: {
    flex: 1,
    textAlign: 'right',
    color: colors.ink[900],
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.bold,
  },
  actions: {
    gap: spacing[2],
    marginTop: spacing[1],
  },
});
