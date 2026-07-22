import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Animated, Easing } from 'react-native';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { Button } from '@pakyaw/shared/components/ui/Button';
import type { TripDoc, SharedRideDoc } from '@pakyaw/shared/features/trip/types';
import { useCancelTrip } from '@pakyaw/shared/features/trip/hooks/useTripActions';

type HopDriverMatchLobbyProps = {
  readonly trip: TripDoc;
  readonly sharedRide?: SharedRideDoc | null;
};

export function HopDriverMatchLobby({ trip, sharedRide }: HopDriverMatchLobbyProps) {
  const { mutate: cancelTrip, isPending: isCancelling } = useCancelTrip();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(25)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, scaleAnim]);

  const driverName = sharedRide?.driverName || trip.driverId ? `Driver #${trip.driverId?.slice(0, 5)}` : 'Driver Matched';
  const vehicleModel = sharedRide?.vehicleModel || 'Pakyaw Fleet Vehicle';
  const vehiclePlate = sharedRide?.vehiclePlate || 'ORM-2026';
  const driverPhoto = sharedRide?.driverPhotoUrl;

  const maxSeats = sharedRide?.maxSeats || 6;
  const totalOccupied = sharedRide?.passengers?.length || 1;
  
  // Generate 6 seat slots representation
  const seats = Array.from({ length: maxSeats }).map((_, index) => {
    const passenger = sharedRide?.passengers?.[index];
    const isOccupied = index < totalOccupied;
    return {
      index,
      isOccupied,
      passenger,
    };
  });

  const handleCancel = () => {
    if (trip) {
      cancelTrip({
        tripId: trip.id,
        by: 'passenger',
        reason: 'Passenger cancelled from lobby screen',
      });
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        },
      ]}
      testID="hop-driver-lobby"
    >
      {/* Header Banner */}
      <View style={styles.headerRow}>
        <View style={styles.matchedBadge}>
          <SymbolIcon name="checkmark.circle.fill" size={16} tintColor={colors.green.primary} />
          <Text style={styles.matchedBadgeText}>HOP DRIVER MATCHED</Text>
        </View>
        <View style={styles.etaBadge}>
          <Text style={styles.etaText}>ETA ~3 mins</Text>
        </View>
      </View>

      <Text style={styles.title}>Your Hop Ride is on the way!</Text>
      <Text style={styles.subtitle}>
        Your driver has accepted your Hop request and is navigating to your pickup point.
      </Text>

      {/* Driver Card */}
      <View style={[styles.driverCard, shadow.card]}>
        <View style={styles.driverProfileRow}>
          <View style={styles.avatarContainer}>
            {driverPhoto ? (
              <Image source={{ uri: driverPhoto }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <SymbolIcon name="person.fill" size={28} tintColor={colors.white} />
              </View>
            )}
            <View style={styles.verifiedCheck}>
              <SymbolIcon name="checkmark" size={10} tintColor={colors.white} />
            </View>
          </View>

          <View style={styles.driverMeta}>
            <Text style={styles.driverName}>{driverName}</Text>
            <Text style={styles.vehicleDetails}>{vehicleModel}</Text>
            <View style={styles.plateContainer}>
              <Text style={styles.plateText}>{vehiclePlate}</Text>
            </View>
          </View>

          <View style={styles.ratingBadge}>
            <SymbolIcon name="star.fill" size={14} tintColor={colors.amber.primary} />
            <Text style={styles.ratingText}>4.9</Text>
          </View>
        </View>

        {/* Seat Allocation Indicator */}
        <View style={styles.seatsSection}>
          <View style={styles.seatsHeader}>
            <Text style={styles.seatsTitle}>PASSENGER SEAT SLOTS</Text>
            <Text style={styles.seatsCount}>
              {totalOccupied} of {maxSeats} Seats Occupied
            </Text>
          </View>

          <View style={styles.slotsRow}>
            {seats.map((seat) => (
              <View
                key={seat.index}
                style={[
                  styles.seatSlot,
                  seat.isOccupied ? styles.seatOccupied : styles.seatEmpty,
                ]}
              >
                {seat.passenger?.passengerPhotoUrl ? (
                  <Image
                    source={{ uri: seat.passenger.passengerPhotoUrl }}
                    style={styles.passengerAvatar}
                  />
                ) : seat.isOccupied ? (
                  <View style={styles.occupiedAvatarIcon}>
                    <SymbolIcon name="person.fill" size={14} tintColor={colors.blue.primary} />
                  </View>
                ) : (
                  <Text style={styles.emptySeatNumber}>{seat.index + 1}</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Fare Summary Bar */}
        <View style={styles.fareSummaryRow}>
          <View>
            <Text style={styles.fareLabel}>HOP FARE</Text>
            <Text style={styles.fareAmount}>
              ₱{(trip.fare || 15.0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.paymentBadge}>
            <SymbolIcon name="banknote" size={14} tintColor={colors.green.primary} />
            <Text style={styles.paymentText}>Cash Payment</Text>
          </View>
        </View>
      </View>

      {/* Driver Info Notice */}
      <View style={styles.driverNoticeCard}>
        <SymbolIcon name="info.circle.fill" size={18} tintColor={colors.blue.primary} />
        <Text style={styles.noticeText}>
          Stay visible near your pickup point. The driver will arrive along their active route line.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsRow}>
        <Button
          label="Cancel Ride"
          onPress={handleCancel}
          loading={isCancelling}
          disabled={isCancelling}
          tone="destructive"
          style={styles.cancelButton}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  matchedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.green.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    gap: spacing[2],
  },
  matchedBadgeText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
    letterSpacing: 0.5,
  },
  etaBadge: {
    backgroundColor: colors.blue.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
  },
  etaText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
  },
  title: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginTop: spacing[2],
  },
  subtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    marginTop: spacing[1],
    lineHeight: 18,
    marginBottom: spacing[4],
  },
  driverCard: {
    backgroundColor: colors.surface.muted,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  driverProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.blue.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedCheck: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.green.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  driverMeta: {
    flex: 1,
  },
  driverName: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  vehicleDetails: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    marginTop: 2,
  },
  plateContainer: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface.muted,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: spacing[1],
  },
  plateText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.ink[700],
    letterSpacing: 0.5,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amber.tint,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    gap: 4,
  },
  ratingText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.amber.primary,
  },
  seatsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing[3],
    marginBottom: spacing[3],
  },
  seatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  seatsTitle: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.ink[400],
    letterSpacing: 0.6,
  },
  seatsCount: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    color: colors.blue.primary,
  },
  slotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seatSlot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  seatOccupied: {
    borderColor: colors.blue.primary,
    backgroundColor: colors.blue.tint,
  },
  seatEmpty: {
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.card,
    borderStyle: 'dashed',
  },
  passengerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  occupiedAvatarIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySeatNumber: {
    fontSize: 12,
    fontWeight: typography.weight.semibold,
    color: colors.ink[400],
  },
  fareSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing[3],
  },
  fareLabel: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.ink[400],
    letterSpacing: 0.5,
  },
  fareAmount: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
    marginTop: 2,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.green.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    gap: spacing[2],
  },
  paymentText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    color: colors.green.primary,
  },
  driverNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blue.tint,
    padding: spacing[3],
    borderRadius: radius.md,
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  noticeText: {
    flex: 1,
    fontSize: typography.size.bodySmall,
    color: colors.blue.primary,
    lineHeight: 16,
  },
  actionButtonsRow: {
    width: '100%',
  },
  cancelButton: {
    width: '100%',
  },
});
