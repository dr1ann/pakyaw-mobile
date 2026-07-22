/**
 * Phase 8E — Driver-side trip status sheets.
 *
 * These inline components render inside drive.tsx's bottom sheet area when
 * the driver has an active trip. Each maps to a trip lifecycle status.
 * Transition buttons will be added in a later phase.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { colors, spacing, typography } from '@/constants/theme';
import { useTripTransition } from '@pakyaw/shared/features/trip/hooks/useTripActions';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';

// ── DriverAcceptedSheet ─────────────────────────────────────────────────────
// Shown when status is 'accepted'. Driver just accepted, about to head out.

type DriverSheetModeProps = {
  readonly compact?: boolean;
};

export function DriverAcceptedSheet({ compact = false }: DriverSheetModeProps) {
  const trip = useActiveTripStore((s) => s.trip);
  const { mutate: transition, isPending } = useTripTransition();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  function handleStartNavigation() {
    if (!trip) return;
    useActiveTripStore.getState().setOptimisticNavEngaged(true);
    useActiveTripStore.getState().setCameraFollowing(true);
    transition(
      { tripId: trip.id, status: 'driver_arriving' },
      {
        onError: () => {
          useActiveTripStore.getState().setOptimisticNavEngaged(false);
        },
      },
    );
  }

  if (compact) {
    return (
      <Animated.View
        style={[
          styles.compactContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.compactInfo}>
          <Text style={styles.compactPrimary} numberOfLines={1}>Trip accepted</Text>
          <Text style={styles.compactSecondary} numberOfLines={1}>
            {trip?.pickup.label ?? 'Pickup location'}
          </Text>
        </View>
        <Button
          label="Navigate"
          onPress={handleStartNavigation}
          loading={isPending}
          disabled={isPending}
          fullWidth={false}
          style={styles.compactButton}
          testID="driver-start-navigation"
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <StatusPill label="Trip accepted" tone="success" dot />
      <Text style={styles.title}>New trip accepted</Text>
      <Text style={styles.subtitle}>
        Head to {trip?.pickup.label ?? 'pickup location'} to pick up your
        passenger.
      </Text>
      <Button
        label="Start navigation"
        onPress={handleStartNavigation}
        loading={isPending}
        disabled={isPending}
        testID="driver-start-navigation"
      />
    </Animated.View>
  );
}

export function DriverEnRouteSheet({
  remainingDistanceMeters,
  etaSeconds,
  compact = false,
}: {
  readonly remainingDistanceMeters?: number | null;
  readonly etaSeconds?: number | null;
  readonly compact?: boolean;
}) {
  const trip = useActiveTripStore((s) => s.trip);
  const { mutate: transition, isPending } = useTripTransition();

  function handleArrived() {
    if (trip) {
      transition({ tripId: trip.id, status: 'driver_arrived' });
    }
  }

  // Use dynamic/projected stats if available; fallback to published driverRoute; fallback to null
  const displayDistanceMeters = remainingDistanceMeters ?? trip?.driverRoute?.distanceMeters ?? null;
  const displayEtaSeconds = etaSeconds ?? trip?.driverRoute?.durationSeconds ?? null;

  const etaMinutes = displayEtaSeconds != null
    ? Math.max(1, Math.round(displayEtaSeconds / 60))
    : null;
  const distanceKm = displayDistanceMeters != null
    ? (displayDistanceMeters / 1000).toFixed(1)
    : null;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactInfo}>
          <Text style={styles.compactPrimary} numberOfLines={1}>
            {etaMinutes != null ? `${etaMinutes} min` : 'To pickup'}
          </Text>
          <Text style={styles.compactSecondary} numberOfLines={1}>
            {distanceKm != null ? `${distanceKm} km` : 'En route'} - {trip?.pickup.label ?? 'Pickup'}
          </Text>
        </View>
        <Button
          label="Arrived"
          onPress={handleArrived}
          loading={isPending}
          disabled={isPending}
          fullWidth={false}
          style={styles.compactButton}
          testID="driver-arrived-at-pickup"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusPill label="En route to pickup" tone="info" dot />
      <Text style={styles.title}>Head to pickup</Text>
      <Text style={styles.subtitle}>
        Heading to {trip?.pickup.label ?? 'pickup location'}
      </Text>

      {displayDistanceMeters != null && (
        <View style={styles.etaCard}>
          <View style={styles.etaRow}>
            <Text style={styles.etaLabel}>DISTANCE TO PICKUP</Text>
            <Text style={styles.etaValue}>{distanceKm} km</Text>
          </View>
          <View style={styles.etaRow}>
            <Text style={styles.etaLabel}>ETA</Text>
            <Text style={styles.etaValue}>{etaMinutes} min</Text>
          </View>
          {displayEtaSeconds != null && (
            <View style={styles.etaRow}>
              <Text style={styles.etaLabel}>ARRIVAL TIME</Text>
              <Text style={styles.etaValue}>{formatArrivalTime(displayEtaSeconds)}</Text>
            </View>
          )}
        </View>
      )}

      <Button
        label="Arrived at pickup"
        onPress={handleArrived}
        loading={isPending}
        disabled={isPending}
        testID="driver-arrived-at-pickup"
      />
    </View>
  );
}

// ── DriverArrivedSheet ──────────────────────────────────────────────────────
// Shown when status is 'driver_arrived'. Driver is at the pickup waiting.

export function DriverArrivedSheet({ compact = false }: DriverSheetModeProps) {
  const trip = useActiveTripStore((s) => s.trip);
  const { mutate: transition, isPending } = useTripTransition();

  function handleStartTrip() {
    if (trip) {
      transition({ tripId: trip.id, status: 'in_progress' });
    }
  }

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactInfo}>
          <Text style={styles.compactPrimary} numberOfLines={1}>At pickup</Text>
          <Text style={styles.compactSecondary} numberOfLines={1}>
            Waiting for passenger
          </Text>
        </View>
        <Button
          label="Start trip"
          onPress={handleStartTrip}
          loading={isPending}
          disabled={isPending}
          fullWidth={false}
          style={styles.compactButton}
          testID="driver-start-trip"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusPill label="At pickup" tone="success" dot />
      <Text style={styles.title}>Waiting for passenger</Text>
      <Text style={styles.subtitle}>
        You have arrived at the pickup location.
      </Text>
      <Button
        label="Start trip"
        onPress={handleStartTrip}
        loading={isPending}
        disabled={isPending}
        testID="driver-start-trip"
      />
    </View>
  );
}

// ── DriverInTripSheet ───────────────────────────────────────────────────────
// Shown when status is 'in_progress'. Ride is underway.

export function DriverInTripSheet({
  remainingDistanceMeters,
  etaSeconds,
  compact = false,
}: {
  readonly remainingDistanceMeters?: number | null;
  readonly etaSeconds?: number | null;
  readonly compact?: boolean;
}) {
  const trip = useActiveTripStore((s) => s.trip);
  const { mutate: transition, isPending } = useTripTransition();

  function handleEndTrip() {
    if (trip) {
      transition({ tripId: trip.id, status: 'completed' });
    }
  }

  // Use dynamic/projected stats if available; fallback to original route stats; fallback to null
  const displayDistanceMeters = remainingDistanceMeters ?? trip?.route?.distanceMeters ?? null;
  const displayEtaSeconds = etaSeconds ?? trip?.route?.durationSeconds ?? null;

  const distanceKm = displayDistanceMeters != null
    ? (displayDistanceMeters / 1000).toFixed(1)
    : null;
  const etaMinutes = displayEtaSeconds != null
    ? Math.max(1, Math.round(displayEtaSeconds / 60))
    : null;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactInfo}>
          <Text style={styles.compactPrimary} numberOfLines={1}>
            {etaMinutes != null ? `${etaMinutes} min` : 'In trip'}
          </Text>
          <Text style={styles.compactSecondary} numberOfLines={1}>
            {distanceKm != null ? `${distanceKm} km` : 'Heading'} - {trip?.destination.label ?? 'Destination'}
          </Text>
        </View>
        <Button
          label="End"
          onPress={handleEndTrip}
          loading={isPending}
          disabled={isPending}
          fullWidth={false}
          style={styles.compactButton}
          testID="driver-end-trip"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusPill label="In progress" tone="info" dot />
      <Text style={styles.title}>Ride in progress</Text>
      <Text style={styles.subtitle}>
        Heading to {trip?.destination.label ?? 'destination'}
      </Text>

      {displayDistanceMeters != null && (
        <View style={styles.etaCard}>
          <View style={styles.etaRow}>
            <Text style={styles.etaLabel}>TRIP DISTANCE</Text>
            <Text style={styles.etaValue}>{distanceKm} km</Text>
          </View>
          <View style={styles.etaRow}>
            <Text style={styles.etaLabel}>ESTIMATED TIME</Text>
            <Text style={styles.etaValue}>{etaMinutes} min</Text>
          </View>
          {displayEtaSeconds != null && (
            <View style={styles.etaRow}>
              <Text style={styles.etaLabel}>ARRIVAL TIME</Text>
              <Text style={styles.etaValue}>{formatArrivalTime(displayEtaSeconds)}</Text>
            </View>
          )}
        </View>
      )}

      <Button
        label="End trip"
        onPress={handleEndTrip}
        loading={isPending}
        disabled={isPending}
        testID="driver-end-trip"
      />
    </View>
  );
}

// ── DriverCompletedSheet ────────────────────────────────────────────────────
// Shown when status is 'completed'.

type DriverCompletedSheetProps = {
  onDismiss: () => void;
};

export function DriverCompletedSheet({ onDismiss }: DriverCompletedSheetProps) {
  return (
    <View style={styles.container}>
      <StatusPill label="Completed" tone="success" dot />
      <Text style={styles.title}>Trip completed</Text>
      <Text style={styles.subtitle}>
        Great job! The ride has been completed successfully.
      </Text>
      <Button label="Done" onPress={onDismiss} />
    </View>
  );
}

// ── DriverCancelledSheet ────────────────────────────────────────────────────
// Shown when status is 'cancelled'.

type DriverCancelledSheetProps = {
  onDismiss: () => void;
};

export function DriverCancelledSheet({ onDismiss }: DriverCancelledSheetProps) {
  const trip = useActiveTripStore((s) => s.trip);
  const cancelledBy = trip?.cancelledBy ?? 'unknown';
  const reason = trip?.cancelReason ?? 'No reason provided.';

  return (
    <View style={styles.container}>
      <StatusPill label="Cancelled" tone="danger" dot />
      <Text style={styles.title}>Trip cancelled</Text>
      <Text style={styles.subtitle}>
        This trip was cancelled by the {cancelledBy}.
      </Text>
      {reason ? <Text style={styles.reason}>{reason}</Text> : null}
      <Button label="Done" onPress={onDismiss} />
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
  reason: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[400],
    fontStyle: 'italic',
  },
  etaCard: {
    backgroundColor: colors.surface.muted,
    borderRadius: 10,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
    marginVertical: spacing[2],
  },
  etaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  etaLabel: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    color: colors.ink[400],
    letterSpacing: typography.letterSpacing.label,
  },
  etaValue: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[900],
    fontWeight: typography.weight.bold,
  },
  compactContainer: {
    minHeight: 76,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  compactInfo: {
    flex: 1,
    minWidth: 0,
  },
  compactPrimary: {
    fontSize: 22,
    fontWeight: typography.weight.extraBold,
    color: colors.ink[900],
  },
  compactSecondary: {
    marginTop: 2,
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
  },
  compactButton: {
    minWidth: 104,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
});

function formatArrivalTime(etaSeconds: number): string {
  const arrivalDate = new Date(Date.now() + etaSeconds * 1000);
  let hours = arrivalDate.getHours();
  const minutes = arrivalDate.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

