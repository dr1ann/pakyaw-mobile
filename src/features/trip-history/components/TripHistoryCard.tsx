import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@pakyaw/shared/components/ui/Card';
import { RouteConnector } from '@pakyaw/shared/components/ui/RouteConnector';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { TripHistoryItem } from '@pakyaw/shared/features/trip-history/types';

export type TripHistoryCardProps = {
  readonly trip: TripHistoryItem;
  readonly onPress: () => void;
};

export function TripHistoryCard({ trip, onPress }: TripHistoryCardProps) {
  const isCompleted = trip.status === 'completed';
  const driverName = trip.driver?.displayName ?? (isCompleted ? 'Pakyaw Driver' : 'No driver assigned');
  const plate = trip.driver?.plate ?? null;
  const dateStr = formatDate(trip.completedAt ?? trip.requestedAt);

  const modeLabel = trip.mode === 'shared' ? 'Shared' : trip.mode === 'hop' ? 'Hop' : 'Pakyaw';

  const distanceKm = trip.distanceMeters && trip.distanceMeters > 0
    ? `${(trip.distanceMeters / 1000).toFixed(1)} km`
    : null;

  const fareFormatted = typeof trip.fare === 'number' && isCompleted
    ? `₱${trip.fare.toFixed(2)}`
    : null;

  const accessibilityLabel = `Trip to ${trip.destination.label}, ${isCompleted ? 'Completed' : 'Cancelled'}, ${dateStr}${fareFormatted ? `, Fare ${fareFormatted}` : ''}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <Card style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.dateTimeText}>{dateStr}</Text>
            <Text style={styles.driverInfoText} numberOfLines={1}>
              {driverName}
            </Text>
            {plate ? <Text style={styles.plateText}>{plate}</Text> : null}
          </View>
          <View style={styles.headerRight}>
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>{modeLabel}</Text>
            </View>
            <StatusPill
              label={isCompleted ? 'Completed' : 'Cancelled'}
              tone={isCompleted ? 'success' : 'danger'}
              dot
            />
          </View>
        </View>

        {/* Route Path */}
        <View style={styles.routeRow}>
          <RouteConnector height={48} />
          <View style={styles.routeText}>
            <Text style={styles.addressText} numberOfLines={1}>
              {trip.pickup.label}
            </Text>
            <Text style={styles.addressText} numberOfLines={1}>
              {trip.destination.label}
            </Text>
          </View>
        </View>

        {/* Footer Meta */}
        <View style={styles.footer}>
          <View style={styles.footerMetaLeft}>
            {trip.bookingFor === 'other' ? (
              <Text style={styles.riderBadge}>
                Rider: {trip.rider?.firstName ?? 'Someone else'}
              </Text>
            ) : null}
            {distanceKm ? (
              <Text style={styles.metaText}>{distanceKm}</Text>
            ) : null}
            {!distanceKm && trip.bookingFor !== 'other' ? (
              <Text style={styles.metaText}>
                {trip.passengerCount} {trip.passengerCount === 1 ? 'passenger' : 'passengers'}
              </Text>
            ) : null}
          </View>

          {isCompleted && fareFormatted ? (
            <Text style={styles.fareText}>{fareFormatted}</Text>
          ) : !isCompleted && trip.cancelReason ? (
            <Text style={styles.cancelReasonText} numberOfLines={1}>
              {formatCancelReason(trip.cancelReason, trip.cancelledBy)}
            </Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

function formatCancelReason(reason: string, cancelledBy?: 'driver' | 'passenger' | null): string {
  if (reason === 'passenger_changed_mind') return 'Changed mind';
  if (reason === 'driver_unavailable') return 'Driver unavailable';
  if (reason === 'unable_to_locate_passenger') return 'Could not locate';
  if (reason === 'vehicle_issue') return 'Vehicle issue';
  if (reason === 'safety_concern') return 'Safety concern';
  if (cancelledBy === 'driver') return 'Cancelled by driver';
  if (cancelledBy === 'passenger') return 'Cancelled by passenger';
  return 'Cancelled';
}

function formatDate(timestamp: any): string {
  if (!timestamp) return '—';
  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (
    typeof timestamp === 'object' &&
    timestamp !== null &&
    'toDate' in timestamp &&
    typeof (timestamp as { toDate: unknown }).toDate === 'function'
  ) {
    date = (timestamp as { toDate: () => Date }).toDate();
  } else if (typeof timestamp === 'object' && timestamp !== null && typeof timestamp.seconds === 'number') {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp as string | number);
  }
  if (isNaN(date.getTime())) return '—';
  return (
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' • ' +
    date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radius.md,
  },
  pressed: {
    opacity: 0.85,
  },
  card: {
    marginBottom: spacing[3],
    gap: spacing[3],
    padding: spacing[4],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    paddingBottom: spacing[3],
  },
  headerLeft: {
    flex: 1,
    gap: spacing[1],
    marginRight: spacing[2],
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  dateTimeText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    fontWeight: typography.weight.medium,
  },
  driverInfoText: {
    fontSize: typography.size.bodyMd,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  plateText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
  },
  modeBadge: {
    backgroundColor: colors.blue.tint,
    borderRadius: radius.xs,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  modeBadgeText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
    letterSpacing: typography.letterSpacing.label,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing[3],
    marginVertical: spacing[1],
  },
  routeText: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing[1],
  },
  addressText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    fontWeight: typography.weight.medium,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  footerMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
  },
  riderBadge: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
    color: colors.amber.primary,
    backgroundColor: colors.amber.tint,
    paddingHorizontal: spacing[2],
    paddingVertical: 1,
    borderRadius: radius.xs,
  },
  metaText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
  },
  fareText: {
    fontSize: typography.size.bodyMd,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  cancelReasonText: {
    fontSize: typography.size.bodySmall,
    color: colors.danger,
    fontStyle: 'italic',
    maxWidth: '50%',
    textAlign: 'right',
  },
});
