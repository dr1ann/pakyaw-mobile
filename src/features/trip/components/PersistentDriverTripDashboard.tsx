import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { Button } from '@pakyaw/shared/components/ui/Button';
import type { TripDoc, SharedRideDoc, TripStatus } from '@pakyaw/shared/features/trip/types';
import { useTripTransition } from '@pakyaw/shared/features/trip/hooks/useTripActions';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type PersistentDriverTripDashboardProps = {
  readonly trip: TripDoc | null;
  readonly sharedRide?: SharedRideDoc | null;
  readonly remainingDistanceMeters?: number | null;
  readonly etaSeconds?: number | null;
  readonly onDismissTerminal?: () => void;
};

export function PersistentDriverTripDashboard({
  trip,
  sharedRide,
  remainingDistanceMeters,
  etaSeconds,
  onDismissTerminal,
}: PersistentDriverTripDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activePassengerIndex, setActivePassengerIndex] = useState(0);

  const { mutate: transition, isPending: isTransitioning } = useTripTransition();

  // Entrance & State Transition Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(25)).current;
  const buttonPulseAnim = useRef(new Animated.Value(1)).current;

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
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Animate button on trip status change for smooth UX feedback
  const status = trip?.status ?? 'accepted';
  useEffect(() => {
    Animated.sequence([
      Animated.timing(buttonPulseAnim, {
        toValue: 0.96,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(buttonPulseAnim, {
        toValue: 1.0,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [status, buttonPulseAnim]);

  const passengers = sharedRide?.passengers || (trip ? [{
    tripId: trip.id,
    passengerId: trip.passengerId,
    passengerName: `Passenger #${trip.passengerId.slice(0, 5)}`,
    seatsCovered: trip.passengerCount || 1,
    pickup: trip.pickup,
    destination: trip.destination,
    status: 'active' as const,
    isHop: trip.mode === 'hop',
    fare: trip.fare || 15.0,
  }] : []);

  const activePassengers = passengers.filter((p) => p.status === 'active');
  const maxSeats = Math.max(sharedRide?.maxSeats || 0, trip?.passengerCount || 0, trip?.billedSeats || 0, 6);
  const totalOccupied = sharedRide?.totalPassengersCount || passengers.length || 1;

  // Calculate earnings summary
  const totalCollectedFare = passengers.reduce((sum, p) => sum + (p.fare || 15), 0);
  const platformFee = passengers.length * 5;
  const driverTakeHome = Math.max(0, totalCollectedFare - platformFee);

  // Generate 6 circular seat slots
  const seats = Array.from({ length: maxSeats }).map((_, index) => {
    const passenger = sharedRide?.passengers?.[index];
    const isOccupied = index < totalOccupied;
    return {
      index,
      isOccupied,
      passenger,
    };
  });

  // Dynamic Navigation & Status Button Actions
  function handlePrimaryAction() {
    if (!trip) return;

    if (status === 'accepted') {
      useActiveTripStore.getState().setOptimisticNavEngaged(true);
      useActiveTripStore.getState().setCameraFollowing(true);
      transition(
        { tripId: trip.id, status: 'driver_arriving' },
        {
          onError: () => {
            useActiveTripStore.getState().setOptimisticNavEngaged(false);
          },
        }
      );
    } else if (status === 'driver_arriving') {
      transition({ tripId: trip.id, status: 'driver_arrived' });
    } else if (status === 'driver_arrived') {
      transition({ tripId: trip.id, status: 'in_progress' });
    } else if (status === 'in_progress') {
      transition({ tripId: trip.id, status: 'completed' });
    } else if (status === 'completed' || status === 'cancelled') {
      if (onDismissTerminal) onDismissTerminal();
    }
  }

  // Dynamic Button Configuration
  const getActionConfig = (status: TripStatus) => {
    switch (status) {
      case 'accepted':
        return { label: 'Start Navigation', tone: 'primary' as const };
      case 'driver_arriving':
        return { label: 'Arrived at Pickup', tone: 'primary' as const };
      case 'driver_arrived':
        return { label: 'Start Trip with Passenger', tone: 'primary' as const };
      case 'in_progress':
        return { label: 'Complete Trip', tone: 'primary' as const };
      case 'completed':
        return { label: 'Done • Back to Map', tone: 'primary' as const };
      default:
        return { label: 'Continue', tone: 'primary' as const };
    }
  };

  const actionConfig = getActionConfig(status);

  // Dynamic Status Badge formatting
  const getStatusBadge = (status: TripStatus) => {
    switch (status) {
      case 'accepted':
        return { label: 'BOOKING ACCEPTED', tone: colors.green.primary, bg: colors.green.tint };
      case 'driver_arriving':
        return { label: 'NAVIGATING TO PICKUP', tone: colors.blue.primary, bg: colors.blue.tint };
      case 'driver_arrived':
        return { label: 'ARRIVED AT PICKUP', tone: colors.amber.primary, bg: colors.amber.tint };
      case 'in_progress':
        return { label: 'RIDE IN PROGRESS', tone: colors.blue.primary, bg: colors.blue.tint };
      case 'completed':
        return { label: 'TRIP COMPLETED', tone: colors.green.primary, bg: colors.green.tint };
      default:
        return { label: 'ON TRIP', tone: colors.blue.primary, bg: colors.blue.tint };
    }
  };

  const badge = getStatusBadge(status);

  // Dynamic ETA & Distance String
  const etaMinutes = etaSeconds != null ? Math.max(1, Math.round(etaSeconds / 60)) : null;
  const distanceKm = remainingDistanceMeters != null ? (remainingDistanceMeters / 1000).toFixed(1) : null;

  return (
    <Animated.View
      style={[
        styles.container,
        isExpanded && styles.containerExpanded,
        shadow.float,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      testID="persistent-driver-dashboard"
    >
      {/* Top Handle & Header Bar */}
      <Pressable onPress={() => setIsExpanded(!isExpanded)} style={styles.handleContainer} testID="driver-dashboard-handle">
        <View style={styles.handleBar} />
        <View style={styles.headerRow}>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <View style={[styles.liveDot, { backgroundColor: badge.tone }]} />
            <Text style={[styles.statusBadgeText, { color: badge.tone }]}>{badge.label}</Text>
          </View>

          <View style={styles.headerRightRow}>
            {etaMinutes != null && (
              <View style={styles.etaBadge}>
                <Text style={styles.etaText}>
                  {distanceKm ? `${distanceKm}km • ` : ''}{etaMinutes} min ETA
                </Text>
              </View>
            )}
            <View style={styles.chevronBox}>
              <SymbolIcon
                name={isExpanded ? 'chevron.down' : 'chevron.up'}
                size={20}
                tintColor={colors.ink[700]}
              />
            </View>
          </View>
        </View>
      </Pressable>

      {/* Driver & Vehicle Profile Header (Always Visible) */}
      <View style={styles.driverProfileRow}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarFallback}>
            <SymbolIcon name="person.fill" size={24} tintColor={colors.white} />
          </View>
          <View style={styles.verifiedCheck}>
            <SymbolIcon name="checkmark" size={10} tintColor={colors.white} />
          </View>
        </View>

        <View style={styles.driverMeta}>
          <Text style={styles.driverName}>
            {sharedRide?.driverName || (trip?.driverId ? `Driver #${trip.driverId.slice(0, 5)}` : 'Pakyaw Driver')}
          </Text>
          <Text style={styles.vehicleDetails}>
            {sharedRide?.vehicleModel || 'Pakyaw Fleet Tricycle'}
          </Text>
        </View>

        <View style={styles.plateTag}>
          <Text style={styles.plateText}>{sharedRide?.vehiclePlate || 'ORM-2026'}</Text>
        </View>
      </View>

      {/* Primary Transition Action Control Button (Persistent) */}
      <Animated.View style={{ transform: [{ scale: buttonPulseAnim }], marginVertical: spacing[3] }}>
        <Button
          label={actionConfig.label}
          onPress={handlePrimaryAction}
          loading={isTransitioning}
          disabled={isTransitioning}
          style={styles.primaryActionButton}
          testID="driver-primary-action-btn"
        />
      </Animated.View>

      {/* Expanded Content Section */}
      {isExpanded && (
        <ScrollView style={styles.expandedScroll} showsVerticalScrollIndicator={false}>
          {/* Passenger Seat Occupancy Grid */}
          <View style={styles.seatsSection}>
            <View style={styles.seatsHeader}>
              <Text style={styles.seatsTitle}>PASSENGER SEAT SLOTS ({totalOccupied}/{maxSeats})</Text>
              <Text style={styles.seatsSubtext}>
                {trip?.mode === 'hop' ? 'Hop On Mode' : trip?.mode === 'shared' ? 'Shared Ride' : 'Private Pakyaw'}
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

          {/* Fare Summary & Earnings Breakdown Card */}
          <View style={[styles.summaryCard, shadow.card]}>
            <Text style={styles.summaryTitle}>TRIP FARES & NET EARNINGS</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Collected Fares:</Text>
              <Text style={styles.summaryValue}>₱{totalCollectedFare.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Platform/Tech Service Fee:</Text>
              <Text style={styles.summaryValueDeduct}>-₱{platformFee.toFixed(2)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Driver Net Earnings:</Text>
              <Text style={styles.summaryValueHighlight}>₱{driverTakeHome.toFixed(2)}</Text>
            </View>
          </View>

          {/* Swipeable Passenger Cards */}
          <View style={styles.passengerHeaderRow}>
            <Text style={styles.sectionTitle}>PASSENGER DETAILS ({passengers.length})</Text>
            {passengers.length > 1 && (
              <Text style={styles.swipeHint}>Swipe left/right ➔</Text>
            )}
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const offsetX = e.nativeEvent.contentOffset.x;
              const index = Math.round(offsetX / (SCREEN_WIDTH - 40));
              setActivePassengerIndex(index);
            }}
            scrollEventThrottle={16}
            contentContainerStyle={styles.cardsScrollContent}
          >
            {passengers.map((p, index) => {
              const pFare = p.fare || 15.0;
              const pFee = 5.0;
              const pNet = Math.max(0, pFare - pFee);

              return (
                <View key={p.tripId || index} style={[styles.passengerCard, shadow.card]}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.passengerMeta}>
                      {p.passengerPhotoUrl ? (
                        <Image source={{ uri: p.passengerPhotoUrl }} style={styles.passengerAvatar} />
                      ) : (
                        <View style={styles.passengerAvatarFallback}>
                          <SymbolIcon name="person.fill" size={18} tintColor={colors.white} />
                        </View>
                      )}
                      <View>
                        <Text style={styles.passengerName}>
                          {p.passengerName || `Passenger ${index + 1}`}
                        </Text>
                        <Text style={styles.passengerSeatsText}>
                          {p.seatsCovered || 1} Seat reserved {p.isHop ? '• Hop Rider' : '• Shared'}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.statusBadgeSmall,
                        p.status === 'active' ? styles.statusActive : styles.statusDone,
                      ]}
                    >
                      <Text style={styles.statusBadgeTextSmall}>
                        {p.status === 'active' ? 'Onboard' : 'Dropped Off'}
                      </Text>
                    </View>
                  </View>

                  {/* Pickup & Dropoff Address */}
                  <View style={styles.routeBox}>
                    <View style={styles.routeRow}>
                      <View style={[styles.dot, styles.dotPickup]} />
                      <Text style={styles.routeText} numberOfLines={1}>
                        From: {p.pickup?.label || 'Pickup Location'}
                      </Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routeRow}>
                      <View style={[styles.dot, styles.dotDest]} />
                      <Text style={styles.routeText} numberOfLines={1}>
                        To: {p.destination?.label || 'Destination'}
                      </Text>
                    </View>
                  </View>

                  {/* Fare Breakdown */}
                  <View style={styles.fareBreakdownBox}>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Fare Amount:</Text>
                      <Text style={styles.breakdownVal}>₱{pFare.toFixed(2)}</Text>
                    </View>
                    <View style={styles.breakdownRowBold}>
                      <Text style={styles.breakdownLabelBold}>Net Earnings:</Text>
                      <Text style={styles.breakdownValBold}>₱{pNet.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Dots Indicator */}
          {passengers.length > 1 && (
            <View style={styles.dotsRow}>
              {passengers.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dotIndicator,
                    i === activePassengerIndex && styles.dotIndicatorActive,
                  ]}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
    maxHeight: 280,
  },
  containerExpanded: {
    maxHeight: 560,
  },
  handleContainer: {
    alignItems: 'center',
    paddingBottom: spacing[2],
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.subtle,
    marginBottom: spacing[2],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    gap: spacing[2],
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  },
  etaBadge: {
    backgroundColor: colors.surface.muted,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
  },
  etaText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  chevronBox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.muted,
    padding: spacing[3],
    borderRadius: radius.md,
    gap: spacing[3],
    marginTop: spacing[2],
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.blue.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedCheck: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.green.primary,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  driverMeta: {
    flex: 1,
  },
  driverName: {
    fontSize: typography.size.bodySmall + 1,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  vehicleDetails: {
    fontSize: 11,
    color: colors.ink[500],
    marginTop: 1,
  },
  plateTag: {
    backgroundColor: colors.surface.card,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  plateText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.ink[700],
    letterSpacing: 0.5,
  },
  primaryActionButton: {
    width: '100%',
  },
  expandedScroll: {
    marginTop: spacing[2],
  },
  seatsSection: {
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  seatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  seatsTitle: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.ink[400],
    letterSpacing: 0.5,
  },
  seatsSubtext: {
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
    width: 38,
    height: 38,
    borderRadius: 19,
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
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  occupiedAvatarIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySeatNumber: {
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    color: colors.ink[400],
  },
  summaryCard: {
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  summaryTitle: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.ink[400],
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  summaryLabel: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
  },
  summaryValue: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
  },
  summaryValueDeduct: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.danger,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing[2],
  },
  summaryLabelBold: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  summaryValueHighlight: {
    fontSize: typography.size.bodyMd,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
  },
  passengerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.ink[500],
    letterSpacing: 0.5,
  },
  swipeHint: {
    fontSize: 10,
    fontWeight: typography.weight.semibold,
    color: colors.blue.primary,
  },
  cardsScrollContent: {
    gap: spacing[3],
    paddingBottom: spacing[2],
  },
  passengerCard: {
    width: SCREEN_WIDTH - 60,
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  passengerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  passengerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.blue.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerName: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  passengerSeatsText: {
    fontSize: 10,
    color: colors.ink[500],
  },
  statusBadgeSmall: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusActive: {
    backgroundColor: colors.green.tint,
  },
  statusDone: {
    backgroundColor: colors.surface.muted,
  },
  statusBadgeTextSmall: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
  },
  routeBox: {
    backgroundColor: colors.surface.muted,
    borderRadius: radius.sm,
    padding: spacing[2],
    marginBottom: spacing[2],
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  routeLine: {
    width: 1,
    height: 10,
    backgroundColor: colors.border.subtle,
    marginLeft: 3.5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotPickup: {
    backgroundColor: colors.blue.primary,
  },
  dotDest: {
    backgroundColor: colors.amber.primary,
  },
  routeText: {
    fontSize: 11,
    color: colors.ink[700],
    flex: 1,
  },
  fareBreakdownBox: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing[2],
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 1,
  },
  breakdownLabel: {
    fontSize: 11,
    color: colors.ink[500],
  },
  breakdownVal: {
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
  },
  breakdownRowBold: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  breakdownLabelBold: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  breakdownValBold: {
    fontSize: 12,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginVertical: spacing[2],
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border.subtle,
  },
  dotIndicatorActive: {
    width: 16,
    backgroundColor: colors.blue.primary,
  },
});
