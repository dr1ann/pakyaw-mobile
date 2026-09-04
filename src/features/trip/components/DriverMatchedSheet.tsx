import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { useCancelTrip } from '@pakyaw/shared/features/trip/hooks/useTripActions';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { haversineMeters } from '@pakyaw/shared/lib/geo';

export function DriverMatchedSheet() {
  const trip = useActiveTripStore((s) => s.trip);
  const driverLocation = useActiveTripStore((s) => s.driverLocation);
  const { mutate: cancel, isPending, isError, error, reset: resetCancel } = useCancelTrip();

  const [confirmCancel, setConfirmCancel] = useState(false);

  // Distance from driver to trip pickup point
  let driverDistanceMeters: number | null = null;
  if (driverLocation && trip?.pickup?.coords) {
    driverDistanceMeters = haversineMeters(
      { lat: driverLocation.latitude, lng: driverLocation.longitude },
      trip.pickup.coords
    );
  }

  // Derived real ETA / Distance string without guesswork
  let etaText = 'Your Driver is on the way';
  if (trip?.tripProgress?.etaSeconds != null && trip.tripProgress.etaSeconds > 0) {
    const minutes = Math.max(1, Math.round(trip.tripProgress.etaSeconds / 60));
    etaText = `~${minutes} min away`;
  } else if (trip?.driverRoute?.durationSeconds != null && trip.driverRoute.durationSeconds > 0) {
    const minutes = Math.max(1, Math.round(trip.driverRoute.durationSeconds / 60));
    etaText = `~${minutes} min away`;
  } else if (driverDistanceMeters != null && driverDistanceMeters > 0) {
    const km = (driverDistanceMeters / 1000).toFixed(1);
    etaText = `${km} km away`;
  }

  const mode = trip?.mode ?? 'solo';
  const isShared = mode === 'shared';
  const isHop = mode === 'hop';

  const driverPublic = trip?.driverPublic;
  const driverName = driverPublic?.displayName || 'Driver Assigned';
  const driverPhoto = driverPublic?.profilePhotoUrl;
  const driverInitial = driverName.charAt(0).toUpperCase();

  const vehicleType = driverPublic?.vehicle.type || 'Tricycle';
  const vehicleDescription = driverPublic?.vehicle.description || vehicleType;
  const plateNumber = driverPublic?.vehicle.plateNumber;
  const unitBodyNumber = driverPublic?.vehicle.unitBodyNumber;

  let authoritativeFare: number | null = null;
  if (trip?.fareBreakdown?.total != null) {
    authoritativeFare = trip.fareBreakdown.total;
  } else if (typeof trip?.fare === 'number') {
    authoritativeFare = trip.fare;
  }

  // Shared occupancy calculations
  const sharedRideSummary = trip?.sharedRideSummary;
  const isSharedOrHop = isShared || isHop;
  const maxSeats = isSharedOrHop
    ? (sharedRideSummary?.maxSeats ?? 6)
    : Math.max(trip?.passengerCount || 0, trip?.billedSeats || 0, 4);

  const userSeats = isHop ? 1 : (trip?.passengerCount || 1);
  const seatsOccupied = isSharedOrHop
    ? (sharedRideSummary?.seatsOccupied ?? userSeats)
    : userSeats;

  const seatSlots = Array.from({ length: maxSeats }).map((_, index) => {
    const isUserSeat = index < userSeats;
    const isOtherOccupied = !isUserSeat && index < seatsOccupied;
    return {
      index,
      isUserSeat,
      isOtherOccupied,
      isOpen: !isUserSeat && !isOtherOccupied,
    };
  });

  function handlePerformCancel() {
    if (!trip) return;
    cancel({
      tripId: trip.id,
      by: 'passenger',
      reason: 'passenger_changed_mind',
    });
  }

  const modeBadgeText = isHop
    ? 'Hop'
    : isShared
    ? 'Shared'
    : 'Pakyaw';


  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      testID="driver-matched-sheet"
    >
      {/* Top Header Row with Mode Badge & Live ETA Pill */}
      <View style={styles.headerRow}>
        <View style={styles.modeBadge}>
          <SymbolIcon name="checkmark.circle.fill" size={14} tintColor={colors.green.primary} />
          <Text style={styles.modeBadgeText}>{modeBadgeText}</Text>
        </View>

        <View style={styles.etaPill}>
          <SymbolIcon name="clock" size={13} tintColor={colors.blue.primary} />
          <Text style={styles.etaPillText}>{etaText}</Text>
        </View>
      </View>

      {/* Driver Profile & Vehicle Card */}
      <View style={[styles.driverCard, shadow.card]}>
        <View style={styles.profileRow}>
          <View style={styles.avatarWrapper}>
            {driverPhoto ? (
              <Image source={{ uri: driverPhoto }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{driverInitial}</Text>
              </View>
            )}
          </View>

          <View style={styles.driverInfo}>
            <Text style={styles.driverName} numberOfLines={1}>
              {driverName}
            </Text>
            <Text style={styles.vehicleDescription} numberOfLines={1}>
              {vehicleDescription}
            </Text>
          </View>
        </View>

        {/* Prominent Vehicle Plate Badge */}
        <View style={styles.vehicleRow}>
          {plateNumber ? (
            <View
              style={styles.plateBadge}
              accessibilityRole="text"
              accessibilityLabel={`Plate number ${plateNumber}`}
            >
              <Text style={styles.plateLabel}>PLATE</Text>
              <Text style={styles.plateNumber}>{plateNumber}</Text>
            </View>
          ) : (
            <View style={styles.plateBadge}>
              <Text style={styles.plateNumber}>Tricycle</Text>
            </View>
          )}

          {unitBodyNumber ? (
            <View style={styles.bodyNumberBadge}>
              <Text style={styles.bodyNumberText}>Body #{unitBodyNumber}</Text>
            </View>
          ) : null}
        </View>

        {/* Shared Occupancy / Private Reservation Section */}
        {isSharedOrHop ? (
          <View style={styles.occupancySection}>
            <View style={styles.occupancyHeader}>
              <Text style={styles.occupancyTitle}>SEAT OCCUPANCY</Text>
              <Text style={styles.occupancyCount}>
                {`${seatsOccupied} of ${maxSeats} seats filled`}
              </Text>
            </View>

            <View
              style={styles.seatRail}
              accessibilityRole="text"
              accessibilityLabel={`Shared ride occupancy: ${seatsOccupied} of ${maxSeats} seats filled`}
            >
              {seatSlots.map((slot) => {
                if (slot.isUserSeat) {
                  return (
                    <View key={slot.index} style={[styles.seatChip, styles.seatChipUser]}>
                      <SymbolIcon name="person.fill" size={13} tintColor={colors.white} />
                      <Text style={styles.seatChipUserText}>You</Text>
                    </View>
                  );
                }
                if (slot.isOtherOccupied) {
                  return (
                    <View key={slot.index} style={[styles.seatChip, styles.seatChipOccupied]}>
                      <SymbolIcon name="person.fill" size={13} tintColor={colors.ink[700]} />
                    </View>
                  );
                }
                return (
                  <View key={slot.index} style={[styles.seatChip, styles.seatChipOpen]}>
                    <Text style={styles.seatChipOpenText}>{slot.index + 1}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.privateInfoRow}>
            <SymbolIcon name="car.fill" size={16} tintColor={colors.blue.primary} />
            <Text style={styles.privateInfoText}>
              Private Pakyaw · Entire tricycle reserved for your group
            </Text>
          </View>
        )}

        {/* Quoted Fare Summary Row */}
        {authoritativeFare != null && (
          <View style={styles.fareRow}>
            <View>
              <Text style={styles.fareLabel}>QUOTED FARE</Text>
              <Text style={styles.fareValue}>₱{authoritativeFare.toFixed(2)}</Text>
            </View>
            <View style={styles.cashBadge}>
              <SymbolIcon name="banknote" size={14} tintColor={colors.green.primary} />
              <Text style={styles.cashBadgeText}>Cash on arrival</Text>
            </View>
          </View>
        )}
      </View>

      {/* Pickup Location Reminder Card */}
      <View style={styles.pickupCard}>
        <SymbolIcon name="mappin.circle.fill" size={18} tintColor={colors.blue.primary} />
        <View style={styles.pickupTextCol}>
          <Text style={styles.pickupTitle}>MEET AT PICKUP</Text>
          <Text style={styles.pickupAddress} numberOfLines={2}>
            {trip?.pickup?.label || 'Your pickup point'}
          </Text>
        </View>
      </View>

      {/* Privacy Transparency Notice */}
      <View style={styles.privacyNoticeCard}>
        <SymbolIcon
          name={trip?.bookingFor === 'other' ? 'person.2.fill' : 'location.fill'}
          size={14}
          tintColor={colors.blue.primary}
        />
        <Text style={styles.privacyNoticeText}>
          {trip?.bookingFor === 'other'
            ? "Because this ride is for someone else, your location won't be shared with the Driver."
            : 'Your live location is temporarily shared with your assigned Driver until pickup to help them find you.'}
        </Text>
      </View>

      {/* Cancellation Error Banner */}
      {isError && (
        <View style={styles.errorBanner}>
          <SymbolIcon name="exclamationmark.triangle.fill" size={16} tintColor={colors.danger} />
          <Text style={styles.errorText}>
            {error?.message || 'Unable to cancel ride. Please try again.'}
          </Text>
          <Pressable onPress={() => resetCancel()} style={styles.dismissBtn}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        </View>
      )}

      {/* Cancellation Action with Confirmation */}
      {confirmCancel ? (
        <View style={styles.confirmBox}>
          <Text style={styles.confirmTitle}>Cancel your confirmed ride?</Text>
          <Text style={styles.confirmSubtitle}>
            Your driver is already on the way to your pickup.
          </Text>
          <View style={styles.confirmActions}>
            <Button
              label="Keep Ride"
              variant="outline"
              onPress={() => setConfirmCancel(false)}
              disabled={isPending}
              style={styles.confirmBtn}
            />
            <Button
              label={isPending ? 'Cancelling...' : 'Yes, Cancel'}
              tone="destructive"
              onPress={handlePerformCancel}
              loading={isPending}
              disabled={isPending}
              style={styles.confirmBtn}
              testID="passenger-confirm-cancel-matched"
            />
          </View>
        </View>
      ) : (
        <Button
          label="Cancel Ride"
          variant="ghost"
          tone="destructive"
          onPress={() => setConfirmCancel(true)}
          disabled={isPending}
          style={styles.cancelBtn}
          testID="passenger-cancel-matched"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    maxHeight: 460,
  },
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[6],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.green.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    gap: spacing[2],
  },
  modeBadgeText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
    letterSpacing: 0.5,
  },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blue.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    gap: 4,
  },
  etaPillText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
  },
  driverCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  avatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.blue.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  vehicleDescription: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    marginTop: 2,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  plateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink[900],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    gap: spacing[2],
  },
  plateLabel: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.ink[400],
    letterSpacing: 0.5,
  },
  plateNumber: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.white,
    letterSpacing: 1,
  },
  bodyNumberBadge: {
    backgroundColor: colors.surface.muted,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  bodyNumberText: {
    fontSize: typography.size.bodySmall - 1,
    fontWeight: typography.weight.semibold,
    color: colors.ink[700],
  },
  occupancySection: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing[3],
    marginBottom: spacing[3],
  },
  occupancyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  occupancyTitle: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.ink[500],
    letterSpacing: 0.6,
  },
  occupancyCount: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    color: colors.blue.primary,
  },
  seatRail: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  seatChip: {
    flex: 1,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  seatChipUser: {
    backgroundColor: colors.blue.primary,
  },
  seatChipUserText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  seatChipOccupied: {
    backgroundColor: colors.surface.muted,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  seatChipOpen: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderStyle: 'dashed',
  },
  seatChipOpenText: {
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    color: colors.ink[400],
  },
  privateInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.blue.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    marginBottom: spacing[3],
  },
  privateInfoText: {
    flex: 1,
    fontSize: typography.size.bodySmall - 1,
    fontWeight: typography.weight.semibold,
    color: colors.blue.deep,
  },
  fareRow: {
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
    color: colors.ink[500],
    letterSpacing: 0.5,
  },
  fareValue: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginTop: 2,
  },
  cashBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.green.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
  },
  cashBadgeText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    color: colors.green.primary,
  },
  pickupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  pickupTextCol: {
    flex: 1,
  },
  pickupTitle: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.ink[500],
    letterSpacing: 0.6,
  },
  pickupAddress: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.medium,
    color: colors.ink[900],
    marginTop: 2,
  },
  privacyNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.blue.tint,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginBottom: spacing[3],
  },
  privacyNoticeText: {
    flex: 1,
    fontSize: typography.size.label,
    fontWeight: typography.weight.medium,
    color: colors.blue.primary,
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.dangerSubtle,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    marginBottom: spacing[3],
  },
  errorText: {
    flex: 1,
    fontSize: typography.size.bodySmall - 1,
    color: colors.danger,
    fontWeight: typography.weight.medium,
  },
  dismissBtn: {
    padding: spacing[1],
  },
  dismissText: {
    fontSize: typography.size.bodySmall - 1,
    fontWeight: typography.weight.bold,
    color: colors.danger,
  },
  confirmBox: {
    backgroundColor: colors.surface.muted,
    padding: spacing[3],
    borderRadius: radius.md,
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
  confirmSubtitle: {
    fontSize: 11,
    color: colors.ink[500],
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing[2],
    width: '100%',
    marginTop: spacing[1],
  },
  confirmBtn: {
    flex: 1,
    height: 44,
  },
  cancelBtn: {
    minHeight: 44,
  },
});
