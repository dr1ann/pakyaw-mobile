/**
 * IncomingRequestCard — Phase 7 driver matching UI.
 *
 * Renders a single nearby trip request with Accept / Decline actions.
 *
 * Accept  → useAcceptTrip mutation. TripAlreadyTakenError is swallowed by
 *           the hook (no toast, no alert) — the card is silently removed
 *           from the local mirror.
 * Decline → expire this addressed offer through the backend. The backend
 *           schedules an immediate retry only when no other offer is pending.
 */

import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
  Vibration,
} from 'react-native';

import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAcceptTrip } from '@/features/matching/hooks/useAcceptTrip';
import { declineTripOffer } from '@/features/matching/services/matching.service';
import type { IncomingRequest } from '@/features/matching/types';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';

type IncomingRequestCardProps = {
  request: IncomingRequest;
};

export function IncomingRequestCard({ request }: IncomingRequestCardProps) {
  const driverUid = useSessionStore((s) => s.uid);
  const acceptMutation = useAcceptTrip();
  const [isMinimized, setIsMinimized] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => request.expiresAt == null
    ? 15
    : Math.max(0, Math.ceil((request.expiresAt - Date.now()) / 1000)));

  useEffect(() => {
    // Notify driver when a request appears
    Vibration.vibrate([0, 500, 200, 500]);
    
    // Set up countdown
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [request.offerId]); // Reset countdown on a new offer

  const isPending = acceptMutation.isPending;
  const disabled = isPending || driverUid == null;
  const isShared = request.mode === 'shared';
  const isHop = request.mode === 'hop';

  const tripDistanceKm = request.route
    ? (request.route.distanceMeters / 1000).toFixed(1)
    : null;
  const tripDurationMin = request.route
    ? Math.round(request.route.durationSeconds / 60)
    : null;
  const distanceText = tripDistanceKm !== null ? `${tripDistanceKm} km trip` : '—';
  const durationText = tripDurationMin !== null ? `~${tripDurationMin} min trip` : '—';

  function handleAccept() {
    if (driverUid == null) return;
    acceptMutation.mutate({ tripId: request.tripId, offerId: request.offerId, driverUid });
  }

  function handleDecline() {
    useAvailabilityStore.getState().removeIncomingRequest(request.tripId);
    if (driverUid !== null) {
      void declineTripOffer(request.tripId, request.offerId, driverUid).catch(() => undefined);
    }
  }

  function handleToggleMinimize() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsMinimized((m) => !m);
  }

  return (
    <View style={[styles.card, shadow.float]} testID="incoming-request-card">
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.badge, isHop ? styles.badgeHop : isShared ? styles.badgeShared : styles.badgePrivate]}>
            <Text style={[styles.badgeText, isHop ? styles.badgeTextHop : isShared ? styles.badgeTextShared : styles.badgeTextPrivate]}>
              {isHop ? 'HOP' : isShared ? 'SHARED RIDE' : 'SOLO'}
            </Text>
          </View>
          <Text style={styles.seats}>
            {request.billedSeats} {request.billedSeats === 1 ? 'seat' : 'seats'}
            {isMinimized && tripDistanceKm && ` · ${tripDistanceKm} km`}
          </Text>
        </View>

        <Pressable
          onPress={handleToggleMinimize}
          style={({ pressed }) => [styles.minimizeButton, pressed && styles.buttonPressed]}
          accessibilityLabel={isMinimized ? "Expand request" : "Collapse request"}
        >
          <SymbolIcon
            name={isMinimized ? 'chevron.down' : 'chevron.up'}
            size={18}
            tintColor={colors.ink[500]}
          />
        </Pressable>
      </View>

      {!isMinimized && (
        <>
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

          {/* Trip Info Rows */}
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Trip distance</Text>
              <Text style={styles.infoValue}>{distanceText}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Trip duration</Text>
              <Text style={styles.infoValue}>{durationText}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Estimated Fare</Text>
              <Text style={styles.infoValue}>{`₱${request.fare.total.toFixed(2)}`}</Text>
            </View>
          </View>
          {(isShared || isHop) && (
            <View style={styles.sharedNotice}>
              <SymbolIcon name="person.3.fill" size={14} tintColor={colors.blue.primary} style={{ marginTop: 2 }} />
              <Text style={styles.sharedNoticeText}>
                {isHop ? 'This Hop request joins the existing Shared Ride only after you accept it.' : 'This is a shared ride. Other passengers may join along the route.'}
              </Text>
            </View>
          )}
        </>
      )}

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decline trip"
          onPress={handleDecline}
          disabled={isPending}
          style={({ pressed }) => [
            styles.actionButton,
            styles.declineButton,
            pressed && styles.actionPressed,
            isPending && styles.actionDisabled,
          ]}
          testID="decline-button"
        >
          <Text style={styles.declineLabel}>Decline</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Accept trip"
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
            <ActivityIndicator color={colors.white} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
    gap: spacing[4],
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
  badgeHop: {
    backgroundColor: colors.amber.tint,
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
  badgeTextHop: {
    color: colors.amber.primary,
  },
  badgeTextPrivate: {
    color: colors.green.primary,
  },
  seats: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    fontWeight: typography.weight.medium,
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
  acceptLabel: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  countdownPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
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
  infoLabel: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    fontWeight: typography.weight.medium,
  },
  infoValue: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[900],
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
    color: colors.blue.primary,
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
});
