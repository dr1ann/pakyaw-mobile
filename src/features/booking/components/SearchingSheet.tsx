import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { Sheet } from '@pakyaw/shared/components/ui/Sheet';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { useCancelTrip } from '@pakyaw/shared/features/trip/hooks/useTripActions';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import type { RideMode } from '@pakyaw/shared/features/trip/types';

type ModePresentation = {
  badge: string;
  title: string;
  subtitle: string;
  timeoutTitle: string;
  timeoutSubtitle: string;
  icon: string;
};

const MODE_CONFIG: Record<RideMode, ModePresentation> = {
  solo: {
    badge: 'Pakyaw · Private',
    title: 'Finding a Pakyaw Driver',
    subtitle: 'Looking for an available Driver for your private trip.',
    timeoutTitle: 'No Driver Found',
    timeoutSubtitle:
      'We could not find an available Driver for your trip right now. You can cancel and try again.',
    icon: 'car.fill',
  },
  shared: {
    badge: 'Shared · Pay per seat',
    title: 'Finding a Shared Ride',
    subtitle: 'Looking for an eligible Shared match along your route.',
    timeoutTitle: 'No Shared Match Found',
    timeoutSubtitle:
      'We could not find an eligible Shared ride for your route right now. You can cancel and try again.',
    icon: 'person.2.fill',
  },
};

export function SearchingSheet() {
  const trip = useActiveTripStore((s) => s.trip);
  const tripId = useActiveTripStore((s) => s.tripId);
  const { mutate: cancel, isPending, isError, error, reset: resetCancel } = useCancelTrip();

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pulseAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [pulseAnim]);

  function handlePerformCancel() {
    const targetId = trip?.id ?? tripId;
    if (!targetId) return;

    cancel({
      tripId: targetId,
      by: 'passenger',
      reason: 'passenger_changed_mind',
    });
  }

  const mode = trip?.mode ?? 'solo';
  const config = MODE_CONFIG[mode] ?? MODE_CONFIG.solo;
  const isTimedOut = trip?.matching?.stage === 'timed_out';

  const authoritativeFare = useMemo(() => {
    if (trip?.fareBreakdown?.total != null) {
      return trip.fareBreakdown.total;
    }
    if (typeof trip?.fare === 'number') {
      return trip.fare;
    }
    return null;
  }, [trip?.fareBreakdown?.total, trip?.fare]);

  // Connecting state when tripId exists but trip document snapshot hasn't resolved yet
  if (!trip) {
    return (
      <Sheet visible dismissOnBackdropPress={false} padded showHandle={false} modal={false}>
        <View style={styles.content} testID="passenger-connecting-sheet">
          <View style={styles.connectingWrapper}>
            <ActivityIndicator size="large" color={colors.blue.primary} />
          </View>

          <View style={styles.statusBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.statusBadgeText}>CONNECTING</Text>
          </View>

          <Text style={styles.title}>Connecting to Ride Network</Text>
          <Text style={styles.subtitle}>Preparing your booking request...</Text>

          <Button
            label={isPending ? 'Cancelling...' : 'Cancel Request'}
            onPress={handlePerformCancel}
            loading={isPending}
            disabled={isPending}
            variant="outline"
            style={styles.cancelBtn}
            testID="passenger-cancel-request"
          />
        </View>
      </Sheet>
    );
  }

  const titleText = isTimedOut ? config.timeoutTitle : config.title;
  const subtitleText = isTimedOut ? config.timeoutSubtitle : config.subtitle;

  return (
    <Sheet visible dismissOnBackdropPress={false} padded showHandle={false} modal={false}>
      <View style={styles.content} testID="passenger-searching-sheet">
        {/* Animated Status Pulse Icon */}
        <View style={styles.iconSection}>
          <Animated.View
            style={[
              styles.pulseRing,
              isTimedOut && styles.pulseRingTimeout,
              {
                transform: [{ scale: isTimedOut ? 1 : pulseAnim }],
              },
            ]}
          />
          <View
            style={[
              styles.iconCircle,
              isTimedOut && styles.iconCircleTimeout,
              shadow.card,
            ]}
          >
            <SymbolIcon
              name={isTimedOut ? 'clock' : config.icon}
              size={28}
              tintColor={isTimedOut ? colors.ink[500] : colors.blue.primary}
            />
          </View>
        </View>

        {/* Mode Tag & Status Badge */}
        <View style={styles.badgeRow}>
          <View style={styles.modeTag}>
            <Text style={styles.modeTagText}>{config.badge}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              isTimedOut && styles.statusBadgeTimeout,
            ]}
          >
            <View
              style={[
                styles.liveDot,
                isTimedOut && styles.liveDotTimeout,
              ]}
            />
            <Text
              style={[
                styles.statusBadgeText,
                isTimedOut && styles.statusBadgeTextTimeout,
              ]}
            >
              {isTimedOut ? 'SEARCH ENDED' : 'LOOKING FOR MATCH'}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{titleText}</Text>
        <Text style={styles.subtitle}>{subtitleText}</Text>

        {/* Route Preview Reassurance */}
        {(trip.pickup?.label || trip.destination?.label) && (
          <View style={styles.routeCard}>
            <View style={styles.routeRow}>
              <View style={[styles.dot, styles.dotPickup]} />
              <Text style={styles.routeText} numberOfLines={1}>
                {trip.pickup?.label || 'Pickup point'}
              </Text>
            </View>
            <View style={styles.routeDivider} />
            <View style={styles.routeRow}>
              <View style={[styles.dot, styles.dotDestination]} />
              <Text style={styles.routeText} numberOfLines={1}>
                {trip.destination?.label || 'Destination'}
              </Text>
            </View>
          </View>
        )}

        {/* Quoted Fare Preview */}
        {authoritativeFare != null && (
          <View style={styles.fareBox}>
            <Text style={styles.fareLabel}>QUOTED FARE</Text>
            <Text style={styles.fareAmount}>₱{authoritativeFare.toFixed(2)}</Text>
          </View>
        )}

        {/* Cancellation Error Banner */}
        {isError && (
          <View style={styles.errorBanner}>
            <SymbolIcon name="exclamationmark.triangle.fill" size={16} tintColor={colors.danger} />
            <Text style={styles.errorBannerText}>
              {error?.message || 'Unable to cancel request. Please try again.'}
            </Text>
            <Pressable onPress={() => resetCancel()} style={styles.errorRetry}>
              <Text style={styles.errorRetryText}>Dismiss</Text>
            </Pressable>
          </View>
        )}

        {/* Cancellation UI with Confirmation Step */}
        {confirmCancel ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Cancel this ride request?</Text>
            <View style={styles.confirmActions}>
              <Button
                label="Keep Waiting"
                variant="outline"
                onPress={() => setConfirmCancel(false)}
                disabled={isPending}
                style={styles.confirmBtnHalf}
              />
              <Button
                label={isPending ? 'Cancelling...' : 'Yes, Cancel'}
                tone="destructive"
                onPress={handlePerformCancel}
                loading={isPending}
                disabled={isPending}
                style={styles.confirmBtnHalf}
                testID="passenger-confirm-cancel"
              />
            </View>
          </View>
        ) : (
          <Button
            label={
              isTimedOut
                ? 'Cancel & Return'
                : isPending
                ? 'Cancelling...'
                : 'Cancel Request'
            }
            onPress={() => {
              if (isTimedOut) {
                handlePerformCancel();
              } else {
                setConfirmCancel(true);
              }
            }}
            loading={isPending}
            disabled={isPending}
            variant={isTimedOut ? 'primary' : 'outline'}
            tone={isTimedOut ? undefined : 'destructive'}
            style={styles.cancelBtn}
            testID="passenger-cancel-request"
          />
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  connectingWrapper: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  iconSection: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  pulseRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.blue.tint,
    borderWidth: 1.5,
    borderColor: 'rgba(47, 128, 237, 0.3)',
  },
  pulseRingTimeout: {
    backgroundColor: colors.surface.muted,
    borderColor: colors.border.subtle,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleTimeout: {
    backgroundColor: colors.surface.muted,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  modeTag: {
    backgroundColor: colors.surface.muted,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  modeTagText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.ink[700],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blue.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    gap: spacing[2],
  },
  statusBadgeTimeout: {
    backgroundColor: colors.surface.muted,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.blue.primary,
  },
  liveDotTimeout: {
    backgroundColor: colors.ink[400],
  },
  statusBadgeText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
    letterSpacing: 0.5,
  },
  statusBadgeTextTimeout: {
    color: colors.ink[500],
  },
  title: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    textAlign: 'center',
    marginTop: spacing[1],
    lineHeight: 18,
    paddingHorizontal: spacing[4],
  },
  routeCard: {
    width: '100%',
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginTop: spacing[3],
    gap: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  routeDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: spacing[4],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotPickup: {
    backgroundColor: colors.blue.primary,
  },
  dotDestination: {
    backgroundColor: colors.amber.primary,
  },
  routeText: {
    flex: 1,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.medium,
    color: colors.ink[700],
  },
  fareBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: colors.surface.muted,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  fareLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.ink[500],
    letterSpacing: 0.5,
  },
  fareAmount: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.dangerSubtle,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    marginTop: spacing[2],
    width: '100%',
  },
  errorBannerText: {
    flex: 1,
    fontSize: typography.size.bodySmall - 1,
    color: colors.danger,
    fontWeight: typography.weight.medium,
  },
  errorRetry: {
    padding: spacing[1],
  },
  errorRetryText: {
    fontSize: typography.size.bodySmall - 1,
    fontWeight: typography.weight.bold,
    color: colors.danger,
  },
  confirmBox: {
    width: '100%',
    backgroundColor: colors.surface.muted,
    padding: spacing[3],
    borderRadius: radius.lg,
    marginTop: spacing[3],
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  confirmTitle: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing[2],
    width: '100%',
  },
  confirmBtnHalf: {
    flex: 1,
    height: 44,
  },
  cancelBtn: {
    marginTop: spacing[3],
    width: '100%',
    minHeight: 48,
  },
});
