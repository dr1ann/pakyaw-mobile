/**
 * IncomingRequestCard — Phase 7 driver matching UI.
 *
 * Renders a single nearby trip request with Accept / Decline actions.
 *
 * Accept  → useAcceptTrip mutation. TripAlreadyTakenError is swallowed by
 *           the hook (no toast, no alert) — the card is silently removed
 *           from the local mirror.
 * Decline → removeIncomingRequest only. NEVER writes to Firestore; the trip
 *           remains claimable by other drivers.
 */

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAcceptTrip } from '@/features/matching/hooks/useAcceptTrip';
import type { IncomingRequest } from '@/features/matching/types';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { useSessionStore } from '@/stores/sessionStore';

type IncomingRequestCardProps = {
  request: IncomingRequest;
};

export function IncomingRequestCard({ request }: IncomingRequestCardProps) {
  const driverUid = useSessionStore((s) => s.uid);
  const acceptMutation = useAcceptTrip();

  const isPending = acceptMutation.isPending;
  const disabled = isPending || driverUid == null;

  function handleAccept() {
    if (driverUid == null) return;
    acceptMutation.mutate({ tripId: request.tripId, driverUid });
  }

  function handleDecline() {
    // Local-only removal — no Firestore write.
    useAvailabilityStore.getState().removeIncomingRequest(request.tripId);
  }

  return (
    <View style={[styles.card, shadow.float]} testID="incoming-request-card">
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>NEW REQUEST</Text>
        </View>
        <Text style={styles.seats}>
          {request.passengerCount} {request.passengerCount === 1 ? 'rider' : 'riders'}
          {request.billedSeats !== request.passengerCount
            ? ` · ${request.billedSeats} seats billed`
            : null}
        </Text>
      </View>

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
            <Text style={styles.acceptLabel}>Accept</Text>
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
  badge: {
    backgroundColor: colors.blue.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
    letterSpacing: typography.letterSpacing.label,
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
  acceptLabel: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  actionPressed: {
    opacity: 0.85,
  },
  actionDisabled: {
    opacity: 0.6,
  },
});
