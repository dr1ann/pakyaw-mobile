import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@pakyaw/shared/components/ui/Card';
import { RouteConnector } from '@pakyaw/shared/components/ui/RouteConnector';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { colors, spacing, typography } from '@/constants/theme';
import type { TripHistoryItem } from '@pakyaw/shared/features/trip-history/types';
import {
  formatPeso,
  formatRoadDistance,
  formatTripDateTime,
  passengerRideModeLabel,
} from '../presentation';

export type TripHistoryCardProps = {
  readonly trip: TripHistoryItem;
  readonly onPress: () => void;
};

export function TripHistoryCard({ trip, onPress }: TripHistoryCardProps) {
  const completed = trip.status === 'completed';
  const occurredAt = completed ? trip.completedAt ?? trip.requestedAt : trip.cancelledAt ?? trip.requestedAt;
  const dateTime = formatTripDateTime(occurredAt) ?? 'Date unavailable';
  const timestampLabel = completed
    ? trip.completedAt ? 'Completed' : 'Requested'
    : trip.cancelledAt ? 'Cancelled' : 'Requested';
  const fare = completed ? formatPeso(trip.fareTotal) : null;
  const distance = completed ? formatRoadDistance(trip.routeDistanceMeters) : null;
  const mode = passengerRideModeLabel(trip.mode);
  const driverName = trip.driver?.displayName ?? null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${completed ? 'Completed' : 'Cancelled'} ${mode} ride, ${trip.pickup.label} to ${trip.destination.label}${fare ? `, trip fare ${fare}` : ''}`}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.dateTime}>{`${timestampLabel} ${dateTime}`}</Text>
            <Text style={styles.mode}>{mode}</Text>
          </View>
          <StatusPill
            label={completed ? 'Completed' : 'Cancelled'}
            tone={completed ? 'success' : 'neutral'}
            dot
          />
        </View>

        <View style={styles.routeRow}>
          <RouteConnector height={52} />
          <View style={styles.routeText}>
            <View>
              <Text style={styles.locationHint}>FROM</Text>
              <Text style={styles.address} numberOfLines={1}>{trip.pickup.label}</Text>
            </View>
            <View>
              <Text style={styles.locationHint}>TO</Text>
              <Text style={styles.address} numberOfLines={1}>{trip.destination.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.driver} numberOfLines={1}>
            {driverName ? `Driver: ${driverName}` : completed ? 'Driver details unavailable' : 'Ride did not start'}
          </Text>
          <View style={styles.valueGroup}>
            {distance ? <Text style={styles.distance}>{distance}</Text> : null}
            {fare ? <Text style={styles.fare}>{fare}</Text> : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing[3],
    gap: spacing[3],
  },
  pressed: {
    opacity: 0.82,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  dateTime: {
    color: colors.ink[500],
    fontSize: typography.size.caption,
    fontFamily: typography.family.medium,
  },
  mode: {
    color: colors.ink[900],
    fontSize: typography.size.bodyMd,
    fontFamily: typography.family.bold,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing[3],
  },
  routeText: {
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  locationHint: {
    color: colors.ink[400],
    fontSize: typography.size.label,
    fontFamily: typography.family.bold,
    letterSpacing: typography.letterSpacing.label,
  },
  address: {
    color: colors.ink[700],
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.semibold,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  driver: {
    color: colors.ink[500],
    fontSize: typography.size.caption,
    fontFamily: typography.family.medium,
    flex: 1,
  },
  valueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[2],
  },
  distance: {
    color: colors.ink[500],
    fontSize: typography.size.caption,
    fontFamily: typography.family.medium,
  },
  fare: {
    color: colors.blue.primary,
    fontSize: typography.size.body,
    fontFamily: typography.family.bold,
  },
});
