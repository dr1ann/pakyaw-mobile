import { formatCancellationReason } from '@pakyaw/shared/features/trip/cancellationReasons';
/**
 * Phase 8E — Driver-side trip status sheets.
 *
 * These inline components render inside drive.tsx's bottom sheet area when
 * the driver has an active trip. Each maps to a trip lifecycle status.
 * Transition buttons will be added in a later phase.
 */

import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useTripTransition } from '@pakyaw/shared/features/trip/hooks/useTripActions';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { usePassengerLiveLocation } from '@/features/trip/hooks/usePassengerLiveLocation';

export function PassengerPickupPresenceCard({
  trip,
  formattedDistanceToPickup,
  hasLiveLocation,
  isBookingForOther,
}: {
  readonly trip: any;
  readonly formattedDistanceToPickup: string | null;
  readonly hasLiveLocation: boolean;
  readonly isBookingForOther: boolean;
}) {
  // ── Third-party booking ─────────────────────────────────────────────────────
  // When a Passenger books for someone else the booker's GPS is suppressed.
  // Show the rider's first name and optional pickup note so the Driver knows
  // who to look for and where.
  if (isBookingForOther) {
    const riderName = trip?.rider?.firstName ?? null;
    const pickupNote = trip?.pickupNote ?? null;
    return (
      <View style={styles.presenceCardOther}>
        <View style={styles.presenceHeader}>
          <View style={styles.presenceDotOther} />
          <Text style={styles.presenceTitleOther}>BOOKED FOR SOMEONE ELSE</Text>
        </View>
        <Text style={styles.presenceText}>
          {riderName ? `Rider: ${riderName}` : 'Third-party booking'}
        </Text>
        {pickupNote ? (
          <Text style={styles.presenceSubtext}>Note: {pickupNote}</Text>
        ) : (
          <Text style={styles.presenceSubtext}>
            Proceed to requested pickup · no live GPS for this booking
          </Text>
        )}
      </View>
    );
  }

  // ── Self booking with live GPS ───────────────────────────────────────────────
  if (hasLiveLocation && formattedDistanceToPickup) {
    return (
      <View style={styles.presenceCard}>
        <View style={styles.presenceHeader}>
          <View style={styles.presenceDot} />
          <Text style={styles.presenceTitle}>PASSENGER GPS</Text>
        </View>
        <Text style={styles.presenceText}>{formattedDistanceToPickup}</Text>
        <Text style={styles.presenceSubtext}>
          Pickup point: {trip?.pickup?.label || 'Requested pickup'}
        </Text>
      </View>
    );
  }

  // ── Self booking, GPS unavailable ────────────────────────────────────────────
  return (
    <View style={styles.presenceCardUnavailable}>
      <Text style={styles.presenceUnavailableText}>
        Passenger live location unavailable · Proceed to requested pickup
      </Text>
    </View>
  );
}

// ── DriverAcceptedSheet ─────────────────────────────────────────────────────
// Shown when status is 'accepted'. Driver just accepted, about to head out.

type DriverSheetModeProps = {
  readonly compact?: boolean;
};

export function DriverAcceptedSheet({ compact = false }: DriverSheetModeProps) {
  const trip = useActiveTripStore((s) => s.trip);
  const { mutate: transition, isPending } = useTripTransition();
  const { passengerLocation, formattedDistanceToPickup, isBookingForOther } =
    usePassengerLiveLocation(
      trip?.id ?? null,
      trip?.status ?? null,
      trip?.pickup?.coords ?? null,
      trip?.bookingFor ?? null
    );

  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(20));

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
      <PassengerPickupPresenceCard
        trip={trip}
        formattedDistanceToPickup={formattedDistanceToPickup}
        hasLiveLocation={!!passengerLocation}
        isBookingForOther={isBookingForOther}
      />
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
  const { passengerLocation, formattedDistanceToPickup, isBookingForOther } =
    usePassengerLiveLocation(
      trip?.id ?? null,
      trip?.status ?? null,
      trip?.pickup?.coords ?? null,
      trip?.bookingFor ?? null
    );

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

      <PassengerPickupPresenceCard
        trip={trip}
        formattedDistanceToPickup={formattedDistanceToPickup}
        hasLiveLocation={!!passengerLocation}
        isBookingForOther={isBookingForOther}
      />

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
  const { passengerLocation, formattedDistanceToPickup, isBookingForOther } =
    usePassengerLiveLocation(
      trip?.id ?? null,
      trip?.status ?? null,
      trip?.pickup?.coords ?? null,
      trip?.bookingFor ?? null
    );

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
      <PassengerPickupPresenceCard
        trip={trip}
        formattedDistanceToPickup={formattedDistanceToPickup}
        hasLiveLocation={!!passengerLocation}
        isBookingForOther={isBookingForOther}
      />
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
  const reason = formatCancellationReason(trip?.cancelReason);

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
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
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
  presenceCard: {
    backgroundColor: colors.blue.tint,
    borderRadius: 10,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[1],
    marginVertical: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(47, 128, 237, 0.20)',
  },
  presenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.blue.primary,
  },
  presenceTitle: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
    letterSpacing: 0.6,
  },
  presenceText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  presenceSubtext: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.medium,
    color: colors.ink[500],
  },
  presenceCardOther: {
    backgroundColor: '#FFF8EC',
    borderRadius: 10,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[1],
    marginVertical: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(234, 136, 6, 0.25)',
  },
  presenceDotOther: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EA8806',
  },
  presenceTitleOther: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: '#B96600',
    letterSpacing: 0.6,
  },
  presenceCardUnavailable: {
    backgroundColor: colors.surface.muted,
    borderRadius: 10,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginVertical: spacing[2],
  },
  presenceUnavailableText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.medium,
    color: colors.ink[500],
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

