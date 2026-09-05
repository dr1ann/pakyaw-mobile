/**
 * CompletedSheet — Phase 8 passenger sheet.
 *
 * Shown when trip status is 'completed'. Confirms the ride finished
 * successfully with authoritative route, fare, driver, and timestamp data.
 */

import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { RouteConnector } from '@pakyaw/shared/components/ui/RouteConnector';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { colors, radius, spacing, typography, motion, useReduceMotion } from '@/constants/theme';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';

type CompletedSheetProps = {
  onDismiss: () => void;
  onViewActivity?: () => void;
};

export function CompletedSheet({ onDismiss, onViewActivity }: CompletedSheetProps) {
  const trip = useActiveTripStore((s: any) => s.trip);
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(14));
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: motion.duration.normal,
        easing: motion.easing.decelerate,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: motion.duration.normal,
        easing: motion.easing.standard,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, reduceMotion]);

  const mode = trip?.mode ?? 'solo';
  const modeLabel = mode === 'shared' ? 'Shared' : mode === 'hop' ? 'Legacy Hop' : 'Pakyaw';

  const fareTotal = typeof trip?.fare === 'number'
    ? trip.fare
    : typeof trip?.fareBreakdown?.total === 'number'
      ? trip.fareBreakdown.total
      : 0;

  const roadDistanceKm = trip?.route && typeof trip.route.distanceMeters === 'number' && trip.route.distanceMeters > 0
    ? (trip.route.distanceMeters / 1000).toFixed(1)
    : null;

  const driverName = trip?.driverPublic?.displayName ?? 'Pakyaw Driver';
  const plateNumber = trip?.driverPublic?.vehicle?.plateNumber ?? null;
  const vehicleDesc = trip?.driverPublic?.vehicle?.description ?? trip?.driverPublic?.vehicle?.type ?? null;

  const dateStr = formatCompletionTime(trip?.completedAt, trip?.requestedAt);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
      testID="completed-sheet"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBadges}>
          <StatusPill label="Completed" tone="success" dot />
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>{modeLabel}</Text>
          </View>
        </View>
        <Text style={styles.tripId} accessibilityLabel={`Trip ID ${trip?.id ?? ''}`}>
          #{trip?.id ? trip.id.slice(-6).toUpperCase() : '------'}
        </Text>
      </View>

      <Text style={styles.title}>Trip completed</Text>
      <Text style={styles.subtitle}>
        Here is the summary of your ride.
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollArea}
      >
        {/* Receipt Card */}
        <View style={styles.receiptCard}>
          {/* Total Fare */}
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Trip fare</Text>
            <Text style={styles.fareAmount}>₱{fareTotal.toFixed(2)}</Text>
          </View>

          <View style={styles.divider} />

          {/* Route Section */}
          <View style={styles.routeContainer}>
            <RouteConnector height={48} />
            <View style={styles.routeLabels}>
              <View style={styles.addressBlock}>
                <Text style={styles.addressType}>PICKUP</Text>
                <Text style={styles.addressText} numberOfLines={2}>
                  {trip?.pickup?.label ?? 'Pickup location'}
                </Text>
              </View>
              <View style={styles.addressBlock}>
                <Text style={styles.addressType}>DESTINATION</Text>
                <Text style={styles.addressText} numberOfLines={2}>
                  {trip?.destination?.label ?? 'Destination location'}
                </Text>
              </View>
            </View>
          </View>

          {/* Road Distance if Authoritative */}
          {roadDistanceKm ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Distance</Text>
              <Text style={styles.metaValue}>{roadDistanceKm} km</Text>
            </View>
          ) : null}

          {/* Driver & Vehicle */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Driver</Text>
            <Text style={styles.metaValue} numberOfLines={1}>{driverName}</Text>
          </View>

          {plateNumber ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Vehicle</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {plateNumber}{vehicleDesc ? ` (${vehicleDesc})` : ''}
              </Text>
            </View>
          ) : null}

          {/* Third-party booking */}
          {trip?.bookingFor === 'other' ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Rider</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {trip?.rider?.firstName ? `${trip.rider.firstName} (Someone else)` : 'Someone else'}
              </Text>
            </View>
          ) : null}

          {/* Completed Timestamp */}
          {dateStr ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Time</Text>
              <Text style={styles.metaValue}>{dateStr}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actionGroup}>
        <Button label="Done" onPress={onDismiss} testID="completed-done-btn" />
        {onViewActivity ? (
          <Pressable
            style={styles.activityLink}
            onPress={onViewActivity}
            accessibilityRole="button"
            accessibilityLabel="View trip in activity"
            testID="completed-activity-link"
          >
            <Text style={styles.activityLinkText}>View in Activity</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

function formatCompletionTime(completedAt: any, requestedAt: any): string {
  const ts = completedAt ?? requestedAt;
  if (!ts) return '';
  let date: Date;
  if (ts instanceof Date) {
    date = ts;
  } else if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof ts.toDate === 'function') {
    date = ts.toDate();
  } else if (typeof ts === 'object' && ts !== null && typeof ts.seconds === 'number') {
    date = new Date(ts.seconds * 1000);
  } else {
    date = new Date(ts);
  }
  if (isNaN(date.getTime())) return '';
  return (
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
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
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    gap: spacing[2],
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
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
  tripId: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[400],
    letterSpacing: 0.5,
  },
  title: {
    fontSize: typography.size.h2,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    marginBottom: spacing[1],
  },
  scrollArea: {
    maxHeight: 320,
  },
  scrollContent: {
    paddingVertical: spacing[1],
  },
  receiptCard: {
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    padding: spacing[4],
    gap: spacing[3],
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    color: colors.ink[700],
  },
  fareAmount: {
    fontSize: typography.size.h2,
    fontWeight: typography.weight.extraBold,
    color: colors.ink[900],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing[3],
    marginVertical: spacing[1],
  },
  routeLabels: {
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  addressBlock: {
    gap: 1,
  },
  addressType: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.ink[400],
    letterSpacing: typography.letterSpacing.label,
  },
  addressText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.medium,
    color: colors.ink[900],
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[2],
  },
  metaLabel: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
  },
  metaValue: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
    maxWidth: '65%',
    textAlign: 'right',
  },
  actionGroup: {
    gap: spacing[2],
    marginTop: spacing[3],
  },
  activityLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    minHeight: 48,
  },
  activityLinkText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
  },
});
