import React, { useEffect, useState } from 'react';
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
  Modal,
} from 'react-native';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { Button } from '@pakyaw/shared/components/ui/Button';
import type { TripDoc, SharedRideDoc, TripStatus, CancelReason } from '@pakyaw/shared/features/trip/types';
import { useTripTransition, useCancelTrip } from '@pakyaw/shared/features/trip/hooks/useTripActions';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { doc, firestore, onSnapshot } from '@/services/firebase/firebase';
import { SosButton } from '@/features/safety/components/SosButton';
import { PassengerPickupPresenceCard } from '@/features/trip/components/DriverTripSheets';
import { usePassengerLiveLocation } from '@/features/trip/hooks/usePassengerLiveLocation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type PersistentDriverTripDashboardProps = {
  readonly trip: TripDoc | null;
  readonly sharedRide?: SharedRideDoc | null;
  readonly remainingDistanceMeters?: number | null;
  readonly etaSeconds?: number | null;
  readonly onDismissTerminal?: () => void;
};

export const CANONICAL_DRIVER_CANCEL_REASONS: { code: CancelReason; label: string }[] = [
  { code: 'unable_to_locate_passenger', label: 'Unable to locate passenger' },
  { code: 'passenger_changed_mind', label: 'Passenger changed mind / requested cancel' },
  { code: 'vehicle_issue', label: 'Vehicle or mechanical issue' },
  { code: 'safety_concern', label: 'Safety or security concern' },
  { code: 'driver_unavailable', label: 'Driver emergency / unavailable' },
  { code: 'other', label: 'Other operational reason' },
];

const formatName = (data: any) => {
  if (!data) return undefined;
  if (data.firstName || data.lastName) {
    return `${data.firstName || ''} ${data.lastName || ''}`.trim();
  }
  return data.displayName || data.fullName || data.name;
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

  const [passengerDoc, setPassengerDoc] = useState<{ name?: string } | null>(null);
  const [showEndTripModal, setShowEndTripModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCancelReason, setSelectedCancelReason] = useState<CancelReason>('unable_to_locate_passenger');
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const { mutate: transition, isPending: isTransitioning } = useTripTransition();
  const { mutate: cancelTrip, isPending: isCancelling } = useCancelTrip();

  const { passengerLocation, formattedDistanceToPickup, isBookingForOther } =
    usePassengerLiveLocation(
      trip?.id ?? null,
      trip?.status ?? null,
      trip?.pickup?.coords ?? null,
      trip?.bookingFor ?? null
    );

  // Entrance & State Transition Animations
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(25));
  const [buttonPulseAnim] = useState(() => new Animated.Value(1));

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

  // Subscribe to passenger user profile snapshot for clean passenger name display
  useEffect(() => {
    if (!trip?.passengerId) return;
    const ref = doc(firestore, 'users', trip.passengerId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap && typeof snap.exists === 'function' && snap.exists()) {
          const u = snap.data();
          const name = formatName(u);
          setPassengerDoc({
            name: name || 'Passenger',
          });
        } else {
          setPassengerDoc({ name: 'Passenger' });
        }
      },
      () => {
        // Fallback gracefully if permissions or network prevent reading user profile
        setPassengerDoc({ name: 'Passenger' });
      },
    );
    return () => unsub();
  }, [trip?.passengerId]);

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

  // Driver identity is the backend-generated Trip snapshot.
  const driverPublic = trip?.driverPublic ?? null;
  const driverName = driverPublic?.displayName ?? 'Driver identity unavailable';
  const vehicleDetails = driverPublic?.vehicle.description ?? driverPublic?.vehicle.type ?? null;
  const vehiclePlate = driverPublic?.vehicle.plateNumber ?? null;

  const thirdPartyRiderName = isBookingForOther && trip?.rider?.firstName ? trip.rider.firstName : null;
  const defaultPassengerName = thirdPartyRiderName || trip?.passengerName || passengerDoc?.name || 'Passenger';

  const passengers = sharedRide?.passengers || (trip ? [{
    tripId: trip.id,
    passengerId: trip.passengerId,
    passengerName: defaultPassengerName,
    passengerPhotoUrl: trip.passengerPhotoUrl,
    seatsCovered: trip.seatsCovered || trip.billedSeats || trip.passengerCount || 1,
    pickup: trip.pickup,
    destination: trip.destination,
    status: 'active' as const,
    isHop: trip.mode === 'hop',
    fare: trip.fare,
  }] : []);

  const isSharedTrip = trip?.mode === 'shared' || sharedRide != null;
  const maxSeats = sharedRide
    ? sharedRide.maxSeats
    : isSharedTrip
      ? (trip?.sharedRideSummary?.maxSeats ?? 0)
      : Math.max(trip?.passengerCount || 0, trip?.billedSeats || 0, 6);

  const totalOccupied = sharedRide
    ? sharedRide.seatsBooked
    : isSharedTrip
      ? (trip?.sharedRideSummary?.seatsOccupied ?? 0)
      : passengers.reduce((sum, p) => sum + (p.seatsCovered || 1), 0);

  // Authoritative fare presentation from trip contract
  const totalCollectedFare = sharedRide
    ? (trip?.fareBreakdown?.total ?? trip?.fare ?? 0)
    : isSharedTrip
      ? (trip?.fareBreakdown?.total ?? trip?.fare ?? 0)
      : (trip?.fareBreakdown?.total ?? trip?.fare ?? passengers.reduce((sum, p) => sum + (p.fare ?? 0), 0));

  // Generate circular seat slots
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
    setActionErrorMessage(null);

    if (status === 'accepted') {
      useActiveTripStore.getState().setOptimisticNavEngaged(true);
      useActiveTripStore.getState().setCameraFollowing(true);
      transition(
        { tripId: trip.id, status: 'driver_arriving' },
        {
          onError: (err) => {
            useActiveTripStore.getState().setOptimisticNavEngaged(false);
            setActionErrorMessage(
              err instanceof Error ? err.message : 'Unable to start navigation. Please check your connection.'
            );
          },
        }
      );
    } else if (status === 'driver_arriving') {
      transition(
        { tripId: trip.id, status: 'driver_arrived' },
        {
          onError: (err) => {
            setActionErrorMessage(
              err instanceof Error ? err.message : 'Unable to confirm arrival. Please try again.'
            );
          },
        }
      );
    } else if (status === 'driver_arrived') {
      transition(
        { tripId: trip.id, status: 'in_progress' },
        {
          onError: (err) => {
            setActionErrorMessage(
              err instanceof Error ? err.message : 'Unable to start trip. Please try again.'
            );
          },
        }
      );
    } else if (status === 'in_progress') {
      // Prompt confirmation before completing active trip
      setShowEndTripModal(true);
    } else if (status === 'completed' || status === 'cancelled') {
      if (onDismissTerminal) onDismissTerminal();
    }
  }

  function handleConfirmEndTrip() {
    if (!trip) return;
    setActionErrorMessage(null);
    transition(
      { tripId: trip.id, status: 'completed' },
      {
        onSuccess: () => {
          setShowEndTripModal(false);
        },
        onError: (err) => {
          setShowEndTripModal(false);
          setActionErrorMessage(
            err instanceof Error ? err.message : 'Unable to complete trip. Please check your connection and retry.'
          );
        },
      }
    );
  }

  function handleConfirmCancel() {
    if (!trip) return;
    setActionErrorMessage(null);
    cancelTrip(
      {
        tripId: trip.id,
        by: 'driver',
        reason: selectedCancelReason,
      },
      {
        onSuccess: () => {
          setShowCancelModal(false);
        },
        onError: (err) => {
          setShowCancelModal(false);
          setActionErrorMessage(
            err instanceof Error ? err.message : 'Unable to cancel trip. Please check your connection.'
          );
        },
      }
    );
  }

  // Dynamic Button Configuration
  const getActionConfig = (status: TripStatus) => {
    switch (status) {
      case 'accepted':
        return { label: 'Start Navigation', tone: 'default' as const };
      case 'driver_arriving':
        return { label: 'Arrived at Pickup', tone: 'default' as const };
      case 'driver_arrived':
        return { label: 'Start Trip', tone: 'default' as const };
      case 'in_progress':
        return { label: 'End Trip', tone: 'default' as const };
      case 'completed':
        return { label: 'Done • Back to Map', tone: 'default' as const };
      case 'cancelled':
        return { label: 'Done • Back to Map', tone: 'default' as const };
      default:
        return { label: 'Continue', tone: 'default' as const };
    }
  };

  const actionConfig = getActionConfig(status);

  // Dynamic Status Badge formatting
  const getStatusBadge = (status: TripStatus) => {
    switch (status) {
      case 'accepted':
        return { label: 'TRIP ACCEPTED', tone: colors.green.primary, bg: colors.green.tint };
      case 'driver_arriving':
        return { label: 'HEADING TO PICKUP', tone: colors.blue.primary, bg: colors.blue.tint };
      case 'driver_arrived':
        return { label: 'ARRIVED AT PICKUP', tone: colors.amber.primary, bg: colors.amber.tint };
      case 'in_progress':
        return { label: 'TRIP IN PROGRESS', tone: colors.blue.primary, bg: colors.blue.tint };
      case 'completed':
        return { label: 'TRIP COMPLETED', tone: colors.green.primary, bg: colors.green.tint };
      case 'cancelled':
        return { label: 'TRIP CANCELLED', tone: colors.danger, bg: 'rgba(235, 87, 87, 0.12)' };
      default:
        return { label: 'ON TRIP', tone: colors.blue.primary, bg: colors.blue.tint };
    }
  };

  const badge = getStatusBadge(status);

  // Dynamic ETA & Distance String
  const etaMinutes = etaSeconds != null ? Math.max(1, Math.round(etaSeconds / 60)) : null;
  const distanceKm = remainingDistanceMeters != null ? (remainingDistanceMeters / 1000).toFixed(1) : null;

  // Active destination context depending on state
  const isHeadingToDestination = status === 'in_progress';
  const targetLabel = isHeadingToDestination
    ? (trip?.destination?.label || 'Destination')
    : (trip?.pickup?.label || 'Pickup Location');
  const targetPrefix = isHeadingToDestination ? 'Heading to destination:' : 'Heading to pickup:';

  // Can the Driver cancel at this stage?
  const canDriverCancel = status === 'accepted' || status === 'driver_arriving' || status === 'driver_arrived';

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
      accessibilityRole="summary"
      accessibilityLabel={`Trip status: ${badge.label}`}
    >
      {/* Top Handle & Header Bar */}
      <Pressable
        onPress={() => setIsExpanded(!isExpanded)}
        style={styles.handleContainer}
        testID="driver-dashboard-handle"
        accessibilityRole="button"
        accessibilityLabel={isExpanded ? 'Collapse trip details' : 'Expand trip details'}
      >
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

      {/* Target Location Banner */}
      <View style={styles.targetBanner}>
        <Text style={styles.targetPrefix}>{targetPrefix}</Text>
        <Text style={styles.targetLocation} numberOfLines={1}>
          {targetLabel}
        </Text>
      </View>

      {/* Driver & Vehicle Profile Header (Always Visible) */}
      <View style={styles.driverProfileRow}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarFallback}>
            <SymbolIcon name="person.fill" size={24} tintColor={colors.white} />
          </View>
          {driverPublic?.verification?.verified === true ? (
            <View style={styles.verifiedCheck}>
              <SymbolIcon name="checkmark" size={10} tintColor={colors.white} />
            </View>
          ) : null}
        </View>

        <View style={styles.driverMeta}>
          <Text style={styles.driverName}>
            {driverName}
          </Text>
          <Text style={styles.vehicleDetails}>
            {vehicleDetails || 'Vehicle details unavailable'}
          </Text>
        </View>

        {vehiclePlate ? (
          <View style={styles.plateTag}>
            <Text style={styles.plateText}>{vehiclePlate}</Text>
          </View>
        ) : null}
      </View>

      {/* Passenger Pickup Presence Card (Live GPS for self-booking or Third-Party Details for other) */}
      {status !== 'completed' && status !== 'cancelled' && status !== 'in_progress' && (
        <PassengerPickupPresenceCard
          trip={trip}
          formattedDistanceToPickup={formattedDistanceToPickup}
          hasLiveLocation={!!passengerLocation}
          isBookingForOther={isBookingForOther}
        />
      )}

      {/* Cancellation Banner if Cancelled */}
      {status === 'cancelled' && (
        <View style={styles.cancelledNoticeBox} testID="cancelled-trip-notice">
          <Text style={styles.cancelledNoticeTitle}>TRIP WAS CANCELLED</Text>
          <Text style={styles.cancelledNoticeText}>
            {`Cancelled by: ${trip?.cancelledBy || 'Passenger'}`}
          </Text>
          {trip?.cancelReason ? (
            <Text style={styles.cancelledNoticeReason}>
              {`Reason: ${trip.cancelReason}`}
            </Text>
          ) : null}
        </View>
      )}

      {/* Completed Banner if Completed */}
      {status === 'completed' && (
        <View style={styles.completedNoticeBox} testID="completed-trip-notice">
          <Text style={styles.completedNoticeTitle}>RIDE COMPLETED SUCCESSFULLY</Text>
          <Text style={styles.completedNoticeText}>
            {`Destination reached: ${trip?.destination?.label || 'Dropoff point'}`}
          </Text>
          <Text style={styles.completedNoticeFare}>
            {`Fare: ₱${totalCollectedFare.toFixed(2)}`}
          </Text>
        </View>
      )}

      {/* Network / Action Error Feedback */}
      {actionErrorMessage && (
        <View style={styles.errorBox} testID="trip-action-error">
          <SymbolIcon name="exclamationmark.triangle.fill" size={16} tintColor={colors.danger} />
          <Text style={styles.errorText} numberOfLines={2}>
            {actionErrorMessage}
          </Text>
          <Pressable
            onPress={() => setActionErrorMessage(null)}
            style={styles.errorDismissBtn}
            accessibilityRole="button"
            accessibilityLabel="Dismiss error"
          >
            <SymbolIcon name="xmark" size={14} tintColor={colors.ink[500]} />
          </Pressable>
        </View>
      )}

      {/* Primary Transition Action Control & Driver Cancel */}
      <View style={styles.actionsRow}>
        <Animated.View style={{ flex: 1, transform: [{ scale: buttonPulseAnim }] }}>
          <Button
            label={isTransitioning ? (status === 'driver_arrived' ? 'Starting...' : isHeadingToDestination ? 'Completing...' : 'Updating...') : actionConfig.label}
            onPress={handlePrimaryAction}
            loading={isTransitioning}
            disabled={isTransitioning || isCancelling}
            style={styles.primaryActionButton}
            testID="driver-primary-action-btn"
          />
        </Animated.View>

        {canDriverCancel && (
          <Button
            label="Cancel Ride"
            onPress={() => setShowCancelModal(true)}
            loading={isCancelling}
            disabled={isCancelling || isTransitioning}
            tone="destructive"
            fullWidth={false}
            style={styles.cancelRideButton}
            testID="driver-cancel-trip-btn"
          />
        )}
      </View>
      <SosButton tripId={trip?.id ?? null} />

      {/* Expanded Content Section */}
      {isExpanded && (
        <ScrollView style={styles.expandedScroll} showsVerticalScrollIndicator={false}>
          {/* Passenger Seat Occupancy Grid (Shared context if available) */}
          {isSharedTrip && (
            <View style={styles.seatsSection}>
              <View style={styles.seatsHeader}>
                <Text style={styles.seatsTitle}>PASSENGER SEAT SLOTS ({totalOccupied}/{maxSeats})</Text>
                <Text style={styles.seatsSubtext}>
                  {trip?.mode === 'hop' ? 'Hop On Mode' : 'Shared Ride'}
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
          )}

          {/* Fare Summary Card */}
          <View style={[styles.summaryCard, shadow.card]}>
            <Text style={styles.summaryTitle}>TRIP FARE & DETAILS</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Booked Fare:</Text>
              <Text style={styles.summaryValue}>₱{totalCollectedFare.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ride Mode:</Text>
              <Text style={styles.summaryValue}>
                {trip?.mode === 'hop' ? 'Hop On' : trip?.mode === 'shared' ? 'Shared' : 'Solo Pakyaw'}
              </Text>
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
              const pFare = p.fare ?? (p.tripId === trip?.id ? trip?.fare : undefined);

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
                          {p.seatsCovered || 1} Seat reserved {p.isHop ? '• Hop Rider' : isSharedTrip ? '• Shared' : isBookingForOther ? '• Booked for someone else' : '• Solo'}
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
                        {p.status === 'active' ? 'Active' : 'Completed'}
                      </Text>
                    </View>
                  </View>

                  {isBookingForOther && trip?.pickupNote ? (
                    <View style={styles.pickupNoteBox}>
                      <Text style={styles.pickupNoteLabel}>PICKUP NOTE</Text>
                      <Text style={styles.pickupNoteText}>{trip.pickupNote}</Text>
                    </View>
                  ) : null}

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
                  {pFare !== undefined && (
                    <View style={styles.fareBreakdownBox}>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Fare Amount:</Text>
                        <Text style={styles.breakdownVal}>₱{pFare.toFixed(2)}</Text>
                      </View>
                    </View>
                  )}
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

      {/* End Trip Confirmation Modal */}
      <Modal
        visible={showEndTripModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndTripModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadow.float]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBox}>
                <SymbolIcon name="checkmark.circle.fill" size={28} tintColor={colors.green.primary} />
              </View>
              <Text style={styles.modalTitle}>Complete This Trip?</Text>
            </View>
            <Text style={styles.modalMessage}>
              {"Confirm that you have arrived at the passenger's destination:"}
            </Text>
            <View style={styles.modalDestBox}>
              <SymbolIcon name="mappin.and.ellipse" size={16} tintColor={colors.amber.primary} />
              <Text style={styles.modalDestText} numberOfLines={2}>
                {trip?.destination?.label || 'Passenger Destination'}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Button
                label={isTransitioning ? 'Completing...' : 'Yes, Complete Trip'}
                onPress={handleConfirmEndTrip}
                loading={isTransitioning}
                disabled={isTransitioning}
                style={styles.modalPrimaryBtn}
                testID="confirm-end-trip-btn"
              />
              <Button
                label="Keep Driving"
                onPress={() => setShowEndTripModal(false)}
                disabled={isTransitioning}
                variant="secondary"
                style={styles.modalSecondaryBtn}
                testID="cancel-end-trip-dialog-btn"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Driver Cancel Ride Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadow.float]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconBox, { backgroundColor: 'rgba(235, 87, 87, 0.12)' }]}>
                <SymbolIcon name="exclamationmark.triangle.fill" size={26} tintColor={colors.danger} />
              </View>
              <Text style={styles.modalTitle}>Cancel This Trip?</Text>
            </View>
            <Text style={styles.modalMessage}>
              Cancelling will notify the passenger and release the booking. Please select a reason:
            </Text>

            <View style={styles.reasonsList}>
              {CANONICAL_DRIVER_CANCEL_REASONS.map((item) => {
                const isSelected = selectedCancelReason === item.code;
                return (
                  <Pressable
                    key={item.code}
                    onPress={() => setSelectedCancelReason(item.code)}
                    style={[
                      styles.reasonOption,
                      isSelected && styles.reasonOptionSelected,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    testID={`cancel-reason-${item.code}`}
                  >
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.reasonLabel, isSelected && styles.reasonLabelSelected]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Button
                label={isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                onPress={handleConfirmCancel}
                loading={isCancelling}
                disabled={isCancelling}
                tone="destructive"
                style={styles.modalPrimaryBtn}
                testID="confirm-cancel-trip-btn"
              />
              <Button
                label="Go Back"
                onPress={() => setShowCancelModal(false)}
                disabled={isCancelling}
                variant="secondary"
                style={styles.modalSecondaryBtn}
                testID="dismiss-cancel-trip-dialog-btn"
              />
            </View>
          </View>
        </View>
      </Modal>
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
    maxHeight: 380,
  },
  containerExpanded: {
    maxHeight: 640,
  },
  targetBanner: {
    backgroundColor: colors.surface.muted,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    marginTop: spacing[1],
    marginBottom: spacing[1],
  },
  targetPrefix: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.ink[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  targetLocation: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginTop: 2,
  },
  pickupNoteBox: {
    backgroundColor: '#FFF8EC',
    borderRadius: radius.sm,
    padding: spacing[2],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(234, 136, 6, 0.25)',
  },
  pickupNoteLabel: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: '#B96600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  pickupNoteText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[900],
    fontWeight: typography.weight.medium,
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
    marginTop: spacing[1],
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginVertical: spacing[3],
  },
  primaryActionButton: {
    minHeight: 52,
    width: '100%',
  },
  cancelRideButton: {
    minHeight: 52,
    paddingHorizontal: spacing[3],
  },
  cancelledNoticeBox: {
    backgroundColor: 'rgba(235, 87, 87, 0.08)',
    borderRadius: radius.md,
    padding: spacing[3],
    marginVertical: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(235, 87, 87, 0.25)',
  },
  cancelledNoticeTitle: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.danger,
    letterSpacing: 0.6,
  },
  cancelledNoticeText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
    marginTop: 2,
  },
  cancelledNoticeReason: {
    fontSize: 11,
    color: colors.ink[500],
    marginTop: 2,
    fontStyle: 'italic',
  },
  completedNoticeBox: {
    backgroundColor: colors.green.tint,
    borderRadius: radius.md,
    padding: spacing[3],
    marginVertical: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(39, 174, 96, 0.25)',
  },
  completedNoticeTitle: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
    letterSpacing: 0.6,
  },
  completedNoticeText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
    marginTop: 2,
  },
  completedNoticeFare: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(235, 87, 87, 0.08)',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    gap: spacing[2],
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(235, 87, 87, 0.20)',
  },
  errorText: {
    flex: 1,
    fontSize: typography.size.label,
    color: colors.danger,
    fontWeight: typography.weight.medium,
  },
  errorDismissBtn: {
    padding: 4,
  },
  expandedScroll: {
    marginTop: spacing[1],
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
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  modalCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing[5],
    width: '100%',
    maxWidth: 380,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  modalIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.green.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    textAlign: 'center',
    marginBottom: spacing[3],
    lineHeight: 18,
  },
  modalDestBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.muted,
    padding: spacing[3],
    borderRadius: radius.md,
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  modalDestText: {
    flex: 1,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
  },
  reasonsList: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.surface.muted,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: spacing[3],
  },
  reasonOptionSelected: {
    borderColor: colors.blue.primary,
    backgroundColor: colors.blue.tint,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.blue.primary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.blue.primary,
  },
  reasonLabel: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    fontWeight: typography.weight.medium,
    flex: 1,
  },
  reasonLabelSelected: {
    color: colors.blue.primary,
    fontWeight: typography.weight.bold,
  },
  modalActions: {
    gap: spacing[2],
  },
  modalPrimaryBtn: {
    minHeight: 52,
    width: '100%',
  },
  modalSecondaryBtn: {
    minHeight: 48,
    width: '100%',
  },
});
