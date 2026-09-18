/**
 * IncomingRequestCard — Phase 11 Driver Incoming Request.
 *
 * Renders a single nearby trip request with authoritative trip details and Accept / Decline actions.
 *
 * Distance rules:
 * - Actual trip distance uses authoritative road distance (request.route.distanceMeters).
 *   Never falls back to straight-line Haversine as "trip distance".
 * - Driver proximity to pickup is calculated from driver GPS to pickup and explicitly labeled as "to pickup".
 *
 * Privacy rules:
 * - NO passenger live GPS displayed before acceptance.
 * - For third-party bookings (bookingFor === 'other'), shows only rider first name and pickup note.
 *
 * Acceptance & Decline Semantics:
 * - Accept and Decline use backend-authoritative callables (acceptTripOffer, declineTripOffer).
 * - Client NEVER infers an authoritative outcome from a network failure.
 * - Network errors show retryable connection feedback without discarding valid offers.
 * - Authoritative 'already_taken' / 'invalid' / 'already_closed' or expiry triggers calm dismissal.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Vibration,
} from 'react-native';

import { colors, radius, shadow, spacing, typography, motion, useReduceMotion } from '@/constants/theme';
import { useAcceptTrip } from '@/features/matching/hooks/useAcceptTrip';
import { declineTripOffer } from '@/features/matching/services/matching.service';
import type { IncomingRequest } from '@/features/matching/types';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { haversineMeters } from '@pakyaw/shared/lib/geo';

type IncomingRequestCardProps = {
  request: IncomingRequest;
};

export function IncomingRequestCard({ request }: IncomingRequestCardProps) {
  const driverUid = useSessionStore((s) => s.uid);
  const lastLatitude = useAvailabilityStore((s) => s.lastLatitude);
  const lastLongitude = useAvailabilityStore((s) => s.lastLongitude);
  const acceptMutation = useAcceptTrip();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(16));
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

  const calculateRemainingSeconds = useCallback(() => {
    if (request.expiresAt == null) return 15;
    return Math.max(0, Math.ceil((request.expiresAt - Date.now()) / 1000));
  }, [request.expiresAt]);

  const [timeLeft, setTimeLeft] = useState(calculateRemainingSeconds);

  // Expiry-driven removal: triggered only when authoritative deadline has elapsed
  const handleExpiry = useCallback(() => {
    useAvailabilityStore.getState().removeIncomingRequest(request.tripId);
    if (driverUid !== null) {
      void declineTripOffer(request.tripId, request.offerId, driverUid).catch(() => undefined);
    }
  }, [driverUid, request.offerId, request.tripId]);

  useEffect(() => {
    // Notify driver when a request appears
    Vibration.vibrate([0, 500, 200, 500]);

    const interval = setInterval(() => {
      const remaining = calculateRemainingSeconds();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        handleExpiry();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemainingSeconds, handleExpiry, request.offerId]);

  const isPending = acceptMutation.isPending;
  const isActionBusy = isPending || isDeclining;
  const isTerminalFeedback =
    statusFeedback === 'This ride is no longer available.' ||
    statusFeedback === 'Request expired or invalid.';
  const disabled = isActionBusy || driverUid == null || isTerminalFeedback;

  const isShared = request.mode === 'shared';
  const isOther = request.bookingFor === 'other';

  // Authoritative road trip distance (pickup → destination)
  const tripRoadDistanceKm = request.route?.distanceMeters != null
    ? (request.route.distanceMeters / 1000).toFixed(1)
    : null;
  const tripDistanceText = tripRoadDistanceKm !== null ? `${tripRoadDistanceKm} km trip` : '—';

  // Authoritative trip duration (pickup → destination)
  const tripDurationMin = request.route?.durationSeconds != null
    ? Math.max(1, Math.round(request.route.durationSeconds / 60))
    : null;
  const tripDurationText = tripDurationMin !== null ? `~${tripDurationMin} min trip` : '—';

  // Driver proximity to pickup (driver GPS → pickup), clearly distinguished
  const driverToPickupMeters =
    lastLatitude !== null &&
    lastLongitude !== null &&
    request.pickup?.coords
      ? haversineMeters(
          { lat: lastLatitude, lng: lastLongitude },
          { lat: request.pickup.coords.lat, lng: request.pickup.coords.lng },
        )
      : null;
  const driverProximityKm = driverToPickupMeters !== null
    ? (driverToPickupMeters / 1000).toFixed(1)
    : null;
  const driverProximityText = driverProximityKm !== null
    ? `${driverProximityKm} km to pickup`
    : null;

  const fareFormatted = `₱${request.fare.total.toFixed(2)}`;

  function handleAccept() {
    if (driverUid == null || disabled) return;
    setStatusFeedback(null);
    acceptMutation.mutate(
      { tripId: request.tripId, offerId: request.offerId, driverUid },
      {
        onSuccess: (result) => {
          if (result === 'already_taken') {
            setStatusFeedback('This ride is no longer available.');
            setTimeout(() => {
              useAvailabilityStore.getState().removeIncomingRequest(request.tripId);
            }, 2000);
          } else if (result === 'invalid') {
            setStatusFeedback('This ride is no longer available.');
            setTimeout(() => {
              useAvailabilityStore.getState().removeIncomingRequest(request.tripId);
            }, 2000);
          }
        },
        onError: (_err) => {
          // Network / Server failure: DO NOT discard valid offer or claim ride taken!
          setStatusFeedback('Connection error. Please try again.');
          setTimeout(() => {
            setStatusFeedback((curr) => (curr === 'Connection error. Please try again.' ? null : curr));
          }, 3000);
        },
      }
    );
  }

  async function handleManualDecline() {
    if (driverUid == null || isActionBusy) return;
    setIsDeclining(true);
    setStatusFeedback(null);
    try {
      const result = await declineTripOffer(request.tripId, request.offerId, driverUid);
      if (result === 'declined' || result === 'already_closed' || result === 'invalid') {
        useAvailabilityStore.getState().removeIncomingRequest(request.tripId);
      }
    } catch {
      // Network / Server failure: DO NOT pretend decline succeeded!
      setStatusFeedback('Connection error. Please try again.');
      setTimeout(() => {
        setStatusFeedback((curr) => (curr === 'Connection error. Please try again.' ? null : curr));
      }, 3000);
    } finally {
      setIsDeclining(false);
    }
  }

  function handleToggleMinimize() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsMinimized((m) => !m);
  }

  const windowHeight = Dimensions.get('window').height;
  const modeLabel = isShared ? 'SHARED' : 'PAKYAW';
  const passengerLabel = `${request.passengerCount} ${request.passengerCount === 1 ? 'passenger' : 'passengers'}`;

  return (
    <Animated.View
      style={[
        styles.card,
        shadow.float,
        {
          maxHeight: Math.min(windowHeight * 0.85, 580),
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      testID="incoming-request-card"
    >
      {/* Header with Mode Badge, Passenger Count, and Minimize Button */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.badge,
              isShared ? styles.badgeShared : styles.badgePrivate,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                isShared ? styles.badgeTextShared : styles.badgeTextPrivate,
              ]}
            >
              {modeLabel}
            </Text>
          </View>
          <Text style={styles.passengersText}>
            {passengerLabel}
            {isMinimized && tripRoadDistanceKm && ` · ${tripRoadDistanceKm} km`}
          </Text>
        </View>

        <Pressable
          onPress={handleToggleMinimize}
          style={({ pressed }) => [styles.minimizeButton, pressed && styles.buttonPressed]}
          accessibilityLabel={isMinimized ? 'Expand request' : 'Collapse request'}
        >
          <SymbolIcon
            name={isMinimized ? 'chevron.down' : 'chevron.up'}
            size={18}
            tintColor={colors.ink[500]}
          />
        </Pressable>
      </View>

      {!isMinimized && (
        <ScrollView
          style={styles.detailsScroll}
          contentContainerStyle={styles.detailsScrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Third-party Booking Notice */}
          {isOther && (
            <View style={styles.otherBookingBanner} testID="third-party-booking-banner">
              <SymbolIcon
                name="person.2.fill"
                size={16}
                tintColor={colors.blue.primary}
                style={{ marginTop: 2 }}
              />
              <View style={styles.otherBookingContent}>
                <Text style={styles.otherBookingTitle}>Booked for someone else</Text>
                <Text style={styles.otherBookingRider}>
                  Rider: {request.rider?.firstName ?? 'Passenger'}
                </Text>
                {request.pickupNote ? (
                  <Text style={styles.otherBookingNote} numberOfLines={2}>
                    Note: &ldquo;{request.pickupNote}&rdquo;
                  </Text>
                ) : null}
              </View>
            </View>
          )}

          {/* Pickup Location */}
          <View style={styles.placeRow}>
            <View style={[styles.dot, styles.dotPickup]} />
            <View style={styles.placeText}>
              <Text style={styles.placeLabel}>PICKUP</Text>
              <Text style={styles.placeValue} numberOfLines={1}>
                {request.pickup.label}
              </Text>
              {request.pickup.address ? (
                <Text style={styles.placeAddress} numberOfLines={1}>
                  {request.pickup.address}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Destination Location */}
          <View style={styles.placeRow}>
            <View style={[styles.dot, styles.dotDestination]} />
            <View style={styles.placeText}>
              <Text style={styles.placeLabel}>DESTINATION</Text>
              <Text style={styles.placeValue} numberOfLines={1}>
                {request.destination.label}
              </Text>
              {request.destination.address ? (
                <Text style={styles.placeAddress} numberOfLines={1}>
                  {request.destination.address}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Trip Info Grid / Breakdown */}
          <View style={styles.infoContainer}>
            {driverProximityText !== null && (
              <View style={styles.infoRow} testID="proximity-row">
                <Text style={styles.infoLabel}>Distance to pickup</Text>
                <Text style={styles.infoValue}>{driverProximityText}</Text>
              </View>
            )}
            <View style={styles.infoRow} testID="trip-distance-row">
              <Text style={styles.infoLabel}>Trip distance</Text>
              <Text style={styles.infoValue}>{tripDistanceText}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Estimated duration</Text>
              <Text style={styles.infoValue}>{tripDurationText}</Text>
            </View>
            {!isShared && (
              <View style={styles.infoRow} testID="pakyaw-buyout-row">
                <Text style={styles.infoLabel}>Pakyaw buyout</Text>
                <Text style={styles.infoValue}>{`${request.billedSeats} seats`}</Text>
              </View>
            )}
            <View style={[styles.infoRow, styles.fareRow]}>
              <Text style={styles.fareLabel}>Authoritative Fare</Text>
              <Text style={styles.fareValue} testID="authoritative-fare">
                {fareFormatted}
              </Text>
            </View>
          </View>

          {/* Shared Guidance */}
          {isShared && (
            <View style={styles.sharedNotice}>
              <SymbolIcon
                name="person.3.fill"
                size={14}
                tintColor={colors.blue.primary}
                style={{ marginTop: 2 }}
              />
              <Text style={styles.sharedNoticeText}>
                {request.sharedRideId
                  ? 'Shared ride: joins your active Shared Ride upon acceptance.'
                  : 'Shared ride: other passengers with matching routes may join.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Race Condition / Status Feedback Banner */}
      {statusFeedback !== null && (
        <View style={styles.feedbackBanner} testID="status-feedback-banner">
          <SymbolIcon
            name="exclamationmark.circle.fill"
            size={16}
            tintColor={colors.amber.primary}
          />
          <Text style={styles.feedbackText}>{statusFeedback}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decline ride request"
          onPress={handleManualDecline}
          disabled={isActionBusy || isTerminalFeedback}
          style={({ pressed }) => [
            styles.actionButton,
            styles.declineButton,
            pressed && styles.actionPressed,
            (isActionBusy || isTerminalFeedback) && styles.actionDisabled,
          ]}
          testID="decline-button"
        >
          {isDeclining ? (
            <View style={styles.declineLoadingContent}>
              <ActivityIndicator color={colors.ink[700]} size="small" />
              <Text style={styles.declineLabel}>Declining…</Text>
            </View>
          ) : (
            <Text style={styles.declineLabel}>Decline</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Accept ride request for ${fareFormatted}`}
          onPress={handleAccept}
          disabled={disabled}
          style={({ pressed }) => [
            styles.actionButton,
            styles.acceptButton,
            pressed && styles.actionPressed,
            disabled && styles.actionDisabled,
          ]}
          testID="accept-button"
        >
          {isPending ? (
            <View style={styles.acceptLoadingContent}>
              <ActivityIndicator color={colors.white} size="small" />
              <Text style={styles.acceptLabel}>Accepting…</Text>
            </View>
          ) : (
            <View style={styles.acceptButtonContent}>
              <Text style={styles.acceptLabel}>Accept</Text>
              <View style={styles.countdownPill}>
                <Text style={styles.countdownText}>{timeLeft}s</Text>
              </View>
            </View>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    gap: spacing[3],
    overflow: 'hidden',
    flexShrink: 1,
  },
  detailsScroll: {
    flexShrink: 1,
  },
  detailsScrollContent: {
    gap: spacing[3],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  minimizeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  badge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
  },
  badgeShared: {
    backgroundColor: colors.blue.tint,
  },
  badgePrivate: {
    backgroundColor: colors.green.tint,
  },
  badgeText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.label,
  },
  badgeTextShared: {
    color: colors.blue.primary,
  },
  badgeTextPrivate: {
    color: colors.green.primary,
  },
  passengersText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    fontWeight: typography.weight.medium,
  },
  otherBookingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.blue.tint,
    borderRadius: radius.md,
    padding: spacing[3],
    gap: spacing[2],
  },
  otherBookingContent: {
    flex: 1,
    gap: 2,
  },
  otherBookingTitle: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
  },
  otherBookingRider: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    fontWeight: typography.weight.medium,
  },
  otherBookingNote: {
    fontSize: typography.size.label,
    color: colors.ink[500],
    fontStyle: 'italic',
    marginTop: 2,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  dotPickup: {
    backgroundColor: colors.green.primary,
  },
  dotDestination: {
    backgroundColor: colors.amber.primary,
  },
  placeText: {
    flex: 1,
  },
  placeLabel: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    color: colors.ink[400],
    letterSpacing: typography.letterSpacing.label,
    marginBottom: 2,
  },
  placeValue: {
    fontSize: typography.size.bodyMd,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
  },
  placeAddress: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    marginTop: 2,
  },
  infoContainer: {
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    padding: spacing[3],
    gap: spacing[2],
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing[2],
    marginTop: 2,
  },
  infoLabel: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    fontWeight: typography.weight.medium,
  },
  infoValue: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[900],
    fontWeight: typography.weight.bold,
  },
  fareLabel: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    fontWeight: typography.weight.bold,
  },
  fareValue: {
    fontSize: typography.size.bodyMd,
    color: colors.green.primary,
    fontWeight: typography.weight.bold,
  },
  sharedNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.blue.tint,
    padding: spacing[3],
    borderRadius: radius.md,
    gap: spacing[2],
  },
  sharedNoticeText: {
    flex: 1,
    fontSize: typography.size.bodySmall,
    color: colors.blue.deep,
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amber.tint,
    padding: spacing[3],
    borderRadius: radius.md,
    gap: spacing[2],
  },
  feedbackText: {
    flex: 1,
    fontSize: typography.size.bodySmall,
    color: colors.amber.deep,
    fontWeight: typography.weight.semibold,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[1],
  },
  actionButton: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    backgroundColor: colors.surface.muted,
  },
  declineLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  declineLabel: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    color: colors.ink[700],
  },
  acceptButton: {
    backgroundColor: colors.green.primary,
  },
  acceptButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  acceptLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  acceptLabel: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  countdownPill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  countdownText: {
    color: colors.white,
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
  },
  actionPressed: {
    opacity: 0.85,
  },
  actionDisabled: {
    opacity: 0.6,
  },
});
