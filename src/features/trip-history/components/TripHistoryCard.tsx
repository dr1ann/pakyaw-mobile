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
  const driverName = trip.driver?.displayName ?? 'Cancelled request';
  const plate = trip.driver?.plate ?? '—';
  const dateStr = formatDate(trip.requestedAt);

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.dateTimeText}>{dateStr}</Text>
            <Text style={styles.driverInfoText}>
              {driverName}
            </Text>
            {trip.driver ? (
              <Text style={styles.plateText}>{plate}</Text>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>PAKYAW</Text>
            </View>
            <StatusPill
              label={trip.status === 'completed' ? 'Completed' : 'Cancelled'}
              tone={trip.status === 'completed' ? 'success' : 'danger'}
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
          <Text style={styles.metaText}>
            Passengers: {trip.passengerCount}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
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
  } else {
    date = new Date(timestamp as string | number);
  }
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
  card: {
    marginBottom: spacing[4],
    gap: spacing[3],
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
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
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
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[2],
  },
  metaText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
  },
});
