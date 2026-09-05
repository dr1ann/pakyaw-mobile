import { formatCancellationReason } from '@pakyaw/shared/features/trip/cancellationReasons';
import { CancellationReasonInput } from '@pakyaw/shared/features/trip/components/CancellationReasonInput';
import { formatUserFriendlyError } from '@pakyaw/shared/lib/userError';
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Modal,
} from 'react-native';
import { colors, radius, spacing, typography, shadow, motion, useReduceMotion } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { Button } from '@pakyaw/shared/components/ui/Button';
import type {
  TripDoc,
  SharedRideDoc,
  SharedRideOperationalStop,
  TripStatus,
} from '@pakyaw/shared/features/trip/types';
import { useTripTransition, useCancelTrip } from '@pakyaw/shared/features/trip/hooks/useTripActions';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { SosButton } from '@/features/safety/components/SosButton';
import { PassengerPickupPresenceCard } from '@/features/trip/components/DriverTripSheets';
import { usePassengerLiveLocation } from '@/features/trip/hooks/usePassengerLiveLocation';

type PersistentDriverTripDashboardProps = {
  readonly trip: TripDoc | null;
  readonly sharedRide?: SharedRideDoc | null;
  readonly memberTrips?: Record<string, TripDoc>;
  readonly currentStop?: SharedRideOperationalStop | null;
  readonly nextStop?: SharedRideOperationalStop | null;
  readonly currentTrip?: TripDoc | null;
  readonly nextTrip?: TripDoc | null;
  readonly occupancy?: {
    readonly seatsReserved: number;
    readonly maxSeats?: number | null;
    readonly onboardCount: number;
    readonly waitingCount: number;
  };
  readonly remainingDistanceMeters?: number | null;
  readonly etaSeconds?: number | null;
  readonly onDismissTerminal?: () => void;
};

export function PersistentDriverTripDashboard({
  trip,
  sharedRide,
  memberTrips = {},
  currentStop,
  nextStop,
  currentTrip,
  nextTrip,
  occupancy,
  remainingDistanceMeters,
  etaSeconds,
  onDismissTerminal,
}: PersistentDriverTripDashboardProps) {
  const isSharedRideSession = sharedRide != null;
  const [isExpanded, setIsExpanded] = useState(isSharedRideSession);
  const [showEndTripModal, setShowEndTripModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCancelReason, setSelectedCancelReason] = useState('');
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const { mutate: transition, isPending: isTransitioning } = useTripTransition();
  const { mutate: cancelTrip, isPending: isCancelling } = useCancelTrip();

  // Active trip for action context (in Shared mode, currentStop's trip; in Solo mode, trip)
  const activeTrip: TripDoc | null = isSharedRideSession ? (currentTrip ?? trip) : trip;

  const { passengerLocation, formattedDistanceToPickup, isBookingForOther } =
    usePassengerLiveLocation(
      activeTrip?.id ?? null,
      activeTrip?.status ?? null,
      activeTrip?.pickup?.coords ?? null,
      activeTrip?.bookingFor ?? null
    );

  // Entrance & State Transition Animations
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(12));
  const [buttonPulseAnim] = useState(() => new Animated.Value(1));
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

  // Animate button on trip status change for smooth UX feedback
  const status = activeTrip?.status ?? (sharedRide?.status === 'completed' ? 'completed' : sharedRide?.status === 'cancelled' ? 'cancelled' : 'accepted');

  useEffect(() => {
    if (reduceMotion) {
      buttonPulseAnim.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.timing(buttonPulseAnim, {
        toValue: 0.98,
        duration: motion.duration.instant,
        useNativeDriver: true,
      }),
      Animated.timing(buttonPulseAnim, {
        toValue: 1.0,
        duration: motion.duration.fast,
        easing: motion.easing.standard,
        useNativeDriver: true,
      }),
    ]).start();
  }, [status, buttonPulseAnim, reduceMotion]);

  // Driver identity from canonical trip
  const driverPublic = activeTrip?.driverPublic ?? null;
  const driverName = driverPublic?.displayName ?? 'Driver identity unavailable';
  const vehicleDetails = driverPublic?.vehicle.description ?? driverPublic?.vehicle.type ?? null;
  const vehiclePlate = driverPublic?.vehicle.plateNumber ?? null;

  // Rider display identity: purely from trip.rider.firstName with 'Rider' fallback (NO users lookup)
  const riderFirstName = activeTrip?.rider?.firstName || activeTrip?.passengerName || 'Rider';
  const nextRiderFirstName = nextTrip?.rider?.firstName || nextTrip?.passengerName || 'Rider';

  // Occupancy values
  const seatsReserved = occupancy?.seatsReserved ?? (sharedRide?.seatsBooked ?? (activeTrip?.billedSeats || 1));
  const maxSeats = occupancy?.maxSeats !== undefined ? occupancy.maxSeats : (sharedRide?.maxSeats ?? null);
  const onboardCount = occupancy?.onboardCount ?? 0;

  // Dynamic Navigation & Status Button Actions
  function handlePrimaryAction() {
    if (!activeTrip) {
      if ((status === 'completed' || status === 'cancelled' || sharedRide?.status === 'completed' || sharedRide?.status === 'cancelled') && onDismissTerminal) {
        onDismissTerminal();
      }
      return;
    }
    setActionErrorMessage(null);

    if (status === 'accepted') {
      useActiveTripStore.getState().setOptimisticNavEngaged(true);
      useActiveTripStore.getState().setCameraFollowing(true);
      transition(
        { tripId: activeTrip.id, status: 'driver_arriving' },
        {
          onError: (err) => {
            useActiveTripStore.getState().setOptimisticNavEngaged(false);
            setActionErrorMessage(
              formatUserFriendlyError(err, 'Unable to update status. Please check your connection.')
            );
          },
        }
      );
    } else if (status === 'driver_arriving') {
      transition(
        { tripId: activeTrip.id, status: 'driver_arrived' },
        {
          onError: (err) => {
            setActionErrorMessage(
              formatUserFriendlyError(err, 'Unable to confirm arrival. Please try again.')
            );
          },
        }
      );
    } else if (status === 'driver_arrived') {
      transition(
        { tripId: activeTrip.id, status: 'in_progress' },
        {
          onError: (err) => {
            setActionErrorMessage(
              formatUserFriendlyError(err, 'Unable to start trip. Please try again.')
            );
          },
        }
      );
    } else if (status === 'in_progress') {
      setShowEndTripModal(true);
    } else if (status === 'completed' || status === 'cancelled') {
      if (onDismissTerminal) onDismissTerminal();
    }
  }

  function handleConfirmEndTrip() {
    if (!activeTrip) return;
    setActionErrorMessage(null);
    transition(
      { tripId: activeTrip.id, status: 'completed' },
      {
        onSuccess: () => {
          setShowEndTripModal(false);
        },
        onError: (err) => {
          setShowEndTripModal(false);
          setActionErrorMessage(
            formatUserFriendlyError(err, 'Unable to complete trip. Please check your connection and retry.')
          );
        },
      }
    );
  }

  function handleConfirmCancel() {
    if (!activeTrip || !selectedCancelReason.trim() || isCancelling) return;
    setActionErrorMessage(null);
    cancelTrip(
      {
        tripId: activeTrip.id,
        by: 'driver',
        reason: selectedCancelReason.trim(),
      },
      {
        onSuccess: () => {
          setShowCancelModal(false);
        },
        onError: (err) => {
          setShowCancelModal(false);
          setActionErrorMessage(
            formatUserFriendlyError(err, 'Unable to cancel trip. Please check your connection.')
          );
        },
      }
    );
  }

  // Dynamic Button Configuration
  const getActionConfig = (tripStatus: TripStatus) => {
    switch (tripStatus) {
      case 'accepted':
        return { label: 'Head to Pickup', tone: 'default' as const };
      case 'driver_arriving':
        return { label: 'Arrived at Pickup', tone: 'default' as const };
      case 'driver_arrived':
        return { label: 'Start Trip', tone: 'default' as const };
      case 'in_progress':
        return { label: 'End Trip', tone: 'default' as const };
      case 'completed':
      case 'cancelled':
        return { label: 'Done • Back to Map', tone: 'default' as const };
      default:
        return { label: 'Continue', tone: 'default' as const };
    }
  };

  const actionConfig = getActionConfig(status);  // Dynamic Status Badge formatting
  const getStatusBadge = (tripStatus: TripStatus) => {
    if (isSharedRideSession && !currentStop && tripStatus !== 'completed' && tripStatus !== 'cancelled') {
      return { label: 'SHARED RIDE IN PROGRESS', tone: colors.blue.primary, bg: colors.blue.tint };
    }
    switch (tripStatus) {
      case 'accepted':
        return { label: isSharedRideSession ? 'SHARED • PICKUP NEXT' : 'TRIP ACCEPTED', tone: colors.green.primary, bg: colors.green.tint };
      case 'driver_arriving':
        return { label: 'HEADING TO PICKUP', tone: colors.blue.primary, bg: colors.blue.tint };
      case 'driver_arrived':
        return { label: 'ARRIVED AT PICKUP', tone: colors.amber.primary, bg: colors.amber.tint };
      case 'in_progress':
        return { label: isSharedRideSession ? 'SHARED • EN ROUTE' : 'TRIP IN PROGRESS', tone: colors.blue.primary, bg: colors.blue.tint };
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
  const targetLabel = isSharedRideSession
    ? (currentStop?.place?.label || (currentStop?.kind === 'dropoff' ? activeTrip?.destination?.label : activeTrip?.pickup?.label) || 'Location')
    : isHeadingToDestination
      ? (activeTrip?.destination?.label || 'Destination')
      : (activeTrip?.pickup?.label || 'Pickup Location');
  const targetPrefix = isSharedRideSession
    ? (currentStop?.kind === 'dropoff'
        ? 'Heading to dropoff:'
        : status === 'driver_arrived'
          ? 'At pickup:'
          : 'Heading to pickup:')
    : isHeadingToDestination
      ? 'Heading to destination:'
      : status === 'driver_arrived'
        ? 'At pickup:'
        : 'Heading to pickup:';

  // Total collected fare
  const totalCollectedFare = activeTrip?.fareBreakdown?.total ?? activeTrip?.fare ?? 0;

  // Cancellation availability
  const canDriverCancel = (status === 'accepted' || status === 'driver_arriving' || status === 'driver_arrived') && activeTrip != null;

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
      {/* Draggable indicator & Header with Dynamic Status Badge */}
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
            {etaMinutes != null && distanceKm != null && status !== 'completed' && status !== 'cancelled' && (
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

      {/* SHARED OPERATIONAL CURRENT STOP CARD (DOMINANT VISUAL COMPONENT) */}
      {isSharedRideSession && currentStop ? (
        <View style={styles.currentStopCard} testID="shared-current-stop-card">
          <View style={styles.currentStopHeaderRow}>
            <View style={styles.stopKindBadge}>
              <Text style={styles.stopKindText}>
                {`CURRENT STOP • ${currentStop.kind.toUpperCase()}`}
              </Text>
            </View>
            <View style={styles.modeTagsRow}>
              <View style={styles.seatsTag}>
                <Text style={styles.seatsTagText}>
                  {`${activeTrip?.billedSeats || 1} ${(activeTrip?.billedSeats || 1) === 1 ? 'seat' : 'seats'}`}
                </Text>
              </View>
              <View style={[styles.modeTag, styles.modeTagShared]}>
                <Text style={[styles.modeTagText, styles.modeTagTextShared]}>
                  Shared
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.currentStopTitle}>
            {currentStop.kind === 'pickup' ? `Pick up ${riderFirstName}` : `Drop off ${riderFirstName}`}
          </Text>
          <Text style={styles.currentStopPlace} numberOfLines={2}>
            {targetLabel}
          </Text>

          {activeTrip?.bookingFor === 'other' && (
            <View style={styles.thirdPartyIndicator}>
              <SymbolIcon name="person.2.fill" size={13} tintColor={colors.blue.primary} />
              <Text style={styles.thirdPartyText}>Booked for someone else</Text>
            </View>
          )}

          {currentStop.kind === 'pickup' && activeTrip?.pickupNote ? (
            <View style={styles.pickupNoteBox}>
              <Text style={styles.pickupNoteLabel}>PICKUP NOTE</Text>
              <Text style={styles.pickupNoteText}>{`"${activeTrip.pickupNote}"`}</Text>
            </View>
          ) : null}
        </View>
      ) : isSharedRideSession && !currentStop ? (
        <View style={styles.currentStopCard} testID="shared-waiting-stop-card">
          <Text style={styles.currentStopTitle}>SHARED RIDE IN PROGRESS</Text>
          <Text style={styles.currentStopPlace}>Awaiting next passenger stop</Text>
        </View>
      ) : (
        /* SOLO TRIP: TARGET LOCATION & RIDER SUMMARY BANNER */
        <View style={styles.targetBanner}>
          <View style={styles.targetHeaderRow}>
            <Text style={styles.targetPrefix}>{targetPrefix}</Text>
            {vehiclePlate ? (
              <View style={styles.plateTag}>
                <Text style={styles.plateText}>{vehiclePlate}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.targetLocation} numberOfLines={1}>
            {targetLabel}
          </Text>
          <View style={styles.riderMetaRow}>
            <SymbolIcon name="person.fill" size={13} tintColor={colors.ink[500]} />
            <Text style={styles.riderMetaText} numberOfLines={1}>
              {riderFirstName} • {seatsReserved} {seatsReserved === 1 ? 'seat' : 'seats'} • ₱{totalCollectedFare.toFixed(2)}
            </Text>
            {driverName ? (
              <Text style={styles.driverA11y} accessibilityRole="text">
                {driverName}
              </Text>
            ) : null}
          </View>

          {activeTrip?.bookingFor === 'other' && (
            <View style={styles.thirdPartyIndicator}>
              <SymbolIcon name="person.2.fill" size={12} tintColor={colors.blue.primary} />
              <Text style={styles.thirdPartyText}>
                {`Booked for other${activeTrip?.rider?.firstName ? `: ${activeTrip.rider.firstName}` : ''}${activeTrip?.pickupNote ? ` · "${activeTrip.pickupNote}"` : ''}`}
              </Text>
            </View>
          )}

          {passengerLocation && formattedDistanceToPickup && (
            <View style={styles.liveGpsBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveGpsText}>Passenger GPS: {formattedDistanceToPickup}</Text>
            </View>
          )}
        </View>
      )}

      {/* SHARED OCCUPANCY / CAPACITY STRIP */}
      {isSharedRideSession && (
        <View style={styles.occupancyStrip} testID="shared-occupancy-strip">
          <View style={styles.occupancyLeft}>
            <SymbolIcon name="person.3.fill" size={16} tintColor={colors.ink[700]} />
            <Text style={styles.occupancyText}>
              <Text style={styles.occupancyBold}>{maxSeats != null ? `${seatsReserved} / ${maxSeats}` : `${seatsReserved}`}</Text> seats reserved • <Text style={styles.occupancyBold}>{`${onboardCount}`}</Text> onboard
            </Text>
          </View>
        </View>
      )}

      {/* FOLLOWING STOP / ROUTE CONTEXT (IF NEXT STOP EXISTS) */}
      {isSharedRideSession && nextStop && (
        <View style={styles.nextStopBar} testID="shared-next-stop-context">
          <Text style={styles.nextStopPrefix}>NEXT STOP</Text>
          <Text style={styles.nextStopLabel} numberOfLines={1}>
            {nextStop.kind === 'pickup' ? `Pick up ${nextRiderFirstName}` : `Drop off ${nextRiderFirstName}`} • {nextTrip?.destination?.label || nextStop.place.label || 'Next Stop'}
          </Text>
        </View>
      )}

      {/* Cancellation Notice Banner */}
      {status === 'cancelled' && (
        <View style={styles.cancelledNoticeBox} testID="cancelled-trip-notice">
          <Text style={styles.cancelledNoticeTitle}>TRIP WAS CANCELLED</Text>
          <Text style={styles.cancelledNoticeText}>
            {`Cancelled by: ${activeTrip?.cancelledBy || 'Passenger'}`}
          </Text>
          {activeTrip?.cancelReason ? (
            <Text style={styles.cancelledNoticeReason}>
              {`Reason: ${formatCancellationReason(activeTrip.cancelReason)}`}
            </Text>
          ) : null}
        </View>
      )}

      {/* Completed Notice Banner */}
      {status === 'completed' && (
        <View style={styles.completedNoticeBox} testID="completed-trip-notice">
          <Text style={styles.completedNoticeTitle}>RIDE COMPLETED SUCCESSFULLY</Text>
          <Text style={styles.completedNoticeText}>
            {`Destination reached: ${activeTrip?.destination?.label || 'Dropoff point'}`}
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

      {/* Primary Transition Action Control & Secondary Actions */}
      <View style={styles.actionsContainer}>
        <Animated.View style={{ width: '100%', transform: [{ scale: buttonPulseAnim }] }}>
          <Button
            label={isTransitioning ? (status === 'driver_arrived' ? 'Starting...' : isHeadingToDestination ? 'Completing...' : 'Updating...') : actionConfig.label}
            onPress={handlePrimaryAction}
            loading={isTransitioning}
            disabled={isTransitioning || isCancelling}
            style={styles.primaryActionButton}
            testID="driver-primary-action-btn"
          />
        </Animated.View>

        {(canDriverCancel || (activeTrip?.id != null && status !== 'completed' && status !== 'cancelled')) && (
          <View style={styles.secondaryActionsRow}>
            {canDriverCancel && (
              <Button
                label="Cancel Ride"
                variant="outline"
                tone="destructive"
                onPress={() => { setSelectedCancelReason(''); setShowCancelModal(true); }}
                loading={isCancelling}
                disabled={isCancelling || isTransitioning}
                style={styles.cancelRideButton}
                testID="driver-cancel-trip-btn"
              />
            )}
            <SosButton tripId={activeTrip?.id ?? null} style={styles.sosButton} />
          </View>
        )}
      </View>

      {/* Expanded Content Section */}
      {isExpanded && (
        <ScrollView style={styles.expandedScroll} showsVerticalScrollIndicator={false}>
          {/* Driver & Vehicle Profile Header (Solo Mode expanded view) */}
          {!isSharedRideSession && (
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
          )}
          {/* SHARED OPERATIONAL MEMBER LIST */}
          {isSharedRideSession && (
            <View style={styles.membersSection} testID="shared-members-list">
              <Text style={styles.sectionTitle}>
                {`PASSENGERS (${sharedRide.members?.length || 0})`}
              </Text>
              {(sharedRide.members || []).map((member) => {
                const mTrip = memberTrips[member.tripId];
                const mRiderName = mTrip?.rider?.firstName || mTrip?.passengerName || 'Rider';
                const isCurrent = member.tripId === currentStop?.tripId;

                const getMemberStatusBadge = () => {
                  if (isCurrent) {
                    return currentStop?.kind === 'pickup'
                      ? { label: 'Pickup next', icon: 'arrow.right', color: colors.blue.primary }
                      : { label: 'Dropoff next', icon: 'arrow.right', color: colors.amber.primary };
                  }
                  switch (member.status) {
                    case 'onboard':
                      return { label: 'Onboard', icon: 'checkmark', color: colors.green.primary };
                    case 'waiting_pickup':
                    case 'reserved':
                      return { label: 'Waiting', icon: 'clock', color: colors.ink[500] };
                    case 'dropped_off':
                      return { label: 'Dropped off', icon: 'checkmark.circle', color: colors.ink[400] };
                    case 'cancelled':
                      return { label: 'Cancelled', icon: 'xmark', color: colors.danger };
                    default:
                      return { label: member.status, icon: 'circle', color: colors.ink[500] };
                  }
                };

                const statusConfig = getMemberStatusBadge();

                return (
                  <View
                    key={member.tripId}
                    style={[styles.memberCard, isCurrent && styles.memberCardCurrent]}
                    testID={`shared-member-card-${member.tripId}`}
                  >
                    <View style={styles.memberLeft}>
                      <View style={[styles.memberIndicator, { backgroundColor: statusConfig.color }]}>
                        <SymbolIcon name={statusConfig.icon} size={12} tintColor={colors.white} />
                      </View>
                      <View style={styles.memberMeta}>
                        <View style={styles.memberNameRow}>
                          <Text style={styles.memberName}>{mRiderName}</Text>
                          {mTrip?.bookingFor === 'other' && (
                            <Text style={styles.memberOtherTag}>• Booked for other</Text>
                          )}
                        </View>
                        <Text style={styles.memberSubtext}>
                          {statusConfig.label} • {member.seats} {member.seats === 1 ? 'seat' : 'seats'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.memberModeBadge, styles.modeTagShared]}>
                      <Text style={[styles.modeTagText, styles.modeTagTextShared]}>
                        Shared
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* SOLO PASSENGER DETAILS */}
          {!isSharedRideSession && activeTrip && (
            <View style={[styles.summaryCard, shadow.card]} testID="solo-passenger-card">
              <View style={styles.cardTopRow}>
                <View style={styles.passengerMeta}>
                  <View style={styles.passengerAvatarFallback}>
                    <SymbolIcon name="person.fill" size={18} tintColor={colors.white} />
                  </View>
                  <View>
                    <Text style={styles.passengerName}>
                      {riderFirstName}
                    </Text>
                    <Text style={styles.passengerSeatsText}>
                      {activeTrip.billedSeats || 1} Seat reserved {activeTrip.bookingFor === 'other' ? '• Booked for someone else' : '• Solo'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.statusBadgeSmall, styles.statusActive]}>
                  <Text style={styles.statusBadgeTextSmall}>
                    {activeTrip.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {activeTrip.bookingFor === 'other' && activeTrip.pickupNote ? (
                <View style={styles.pickupNoteBox}>
                  <Text style={styles.pickupNoteLabel}>PICKUP NOTE</Text>
                  <Text style={styles.pickupNoteText}>{`"${activeTrip.pickupNote}"`}</Text>
                </View>
              ) : null}

              {/* Pickup & Destination Address */}
              <View style={styles.routeBox}>
                <View style={styles.routeRow}>
                  <View style={[styles.dot, styles.dotPickup]} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    From: {activeTrip.pickup?.label || 'Pickup Location'}
                  </Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeRow}>
                  <View style={[styles.dot, styles.dotDest]} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    To: {activeTrip.destination?.label || 'Destination'}
                  </Text>
                </View>
              </View>

              {/* Fare Breakdown */}
              <View style={styles.fareBreakdownBox}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Total Fare:</Text>
                  <Text style={styles.breakdownVal}>₱{totalCollectedFare.toFixed(2)}</Text>
                </View>
              </View>
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
              {"Confirm that you have arrived at the destination for "}
              <Text style={{ fontWeight: 'bold' }}>{riderFirstName}</Text>:
            </Text>
            <View style={styles.modalDestBox}>
              <SymbolIcon name="mappin.and.ellipse" size={16} tintColor={colors.amber.primary} />
              <Text style={styles.modalDestText} numberOfLines={2}>
                {activeTrip?.destination?.label || 'Destination'}
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
          <ScrollView style={[styles.modalCard, shadow.float, { maxHeight: '90%' }]} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconBox, { backgroundColor: 'rgba(235, 87, 87, 0.12)' }]}>
                <SymbolIcon name="exclamationmark.triangle.fill" size={26} tintColor={colors.danger} />
              </View>
              <Text style={styles.modalTitle}>Cancel This Trip?</Text>
            </View>
            <Text style={styles.modalMessage}>
              Cancelling will release the booking for {riderFirstName}. Please choose a cancellation reason:
            </Text>

            <CancellationReasonInput value={selectedCancelReason} onChangeText={setSelectedCancelReason} disabled={isCancelling} />

            <View style={styles.modalActions}>
              <Button
                label={isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                onPress={handleConfirmCancel}
                loading={isCancelling}
                disabled={isCancelling || !selectedCancelReason.trim()}
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
          </ScrollView>
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
    paddingBottom: spacing[3],
    maxHeight: '55%',
  },
  containerExpanded: {
    maxHeight: '85%',
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
  currentStopCard: {
    backgroundColor: '#F3F6FD',
    borderRadius: radius.md,
    padding: spacing[3],
    marginVertical: spacing[2],
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  currentStopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[1],
  },
  stopKindBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  stopKindText: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.white,
    letterSpacing: 0.5,
  },
  modeTagsRow: {
    flexDirection: 'row',
    gap: spacing[1],
  },
  seatsTag: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  seatsTagText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: '#1D4ED8',
  },
  modeTag: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  modeTagShared: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  modeTagText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
  },
  modeTagTextShared: {
    color: '#047857',
  },
  currentStopTitle: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginTop: spacing[1],
  },
  currentStopPlace: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[700],
    marginTop: 2,
  },
  thirdPartyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing[1],
  },
  thirdPartyText: {
    fontSize: 11,
    color: colors.blue.primary,
    fontWeight: typography.weight.medium,
  },
  occupancyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.muted,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    marginBottom: spacing[2],
  },
  occupancyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  occupancyText: {
    fontSize: 12,
    color: colors.ink[700],
  },
  occupancyBold: {
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  nextStopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5FF',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: '#E9D5FF',
    gap: spacing[2],
  },
  nextStopPrefix: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: '#7E22CE',
    letterSpacing: 0.5,
  },
  nextStopLabel: {
    fontSize: 12,
    color: '#581C87',
    fontWeight: typography.weight.semibold,
    flex: 1,
  },
  targetBanner: {
    backgroundColor: colors.surface.muted,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    marginTop: spacing[1],
    marginBottom: spacing[1],
  },
  targetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
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
  riderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: 3,
  },
  riderMetaText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    fontWeight: typography.weight.medium,
  },
  driverA11y: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  liveGpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  liveGpsText: {
    fontSize: 11,
    color: colors.green.primary,
    fontWeight: typography.weight.semibold,
  },
  pickupNoteBox: {
    backgroundColor: '#FFF8EC',
    borderRadius: radius.sm,
    padding: spacing[2],
    marginTop: spacing[2],
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
  actionsContainer: {
    marginTop: spacing[2],
  },
  primaryActionButton: {
    minHeight: 48,
    width: '100%',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  cancelRideButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing[2],
  },
  sosButton: {
    flex: 1,
    minHeight: 44,
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
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cancelledNoticeText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    fontWeight: typography.weight.medium,
  },
  cancelledNoticeReason: {
    fontSize: 11,
    color: colors.danger,
    marginTop: 2,
  },
  completedNoticeBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: radius.md,
    padding: spacing[3],
    marginVertical: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  completedNoticeTitle: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  completedNoticeText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    fontWeight: typography.weight.medium,
  },
  completedNoticeFare: {
    fontSize: 12,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(235, 87, 87, 0.1)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: colors.danger,
    fontWeight: typography.weight.medium,
  },
  errorDismissBtn: {
    padding: 4,
  },
  expandedScroll: {
    marginTop: spacing[1],
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: colors.ink[500],
    letterSpacing: 0.5,
    marginBottom: spacing[2],
    textTransform: 'uppercase',
  },
  membersSection: {
    marginVertical: spacing[2],
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.muted,
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[2],
  },
  memberCardCurrent: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
  },
  memberIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberMeta: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  memberName: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  memberOtherTag: {
    fontSize: 10,
    color: colors.blue.primary,
  },
  memberSubtext: {
    fontSize: 11,
    color: colors.ink[500],
    marginTop: 1,
  },
  memberModeBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  summaryCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing[3],
    marginVertical: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  passengerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  passengerAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.ink[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerName: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  passengerSeatsText: {
    fontSize: 11,
    color: colors.ink[500],
  },
  statusBadgeSmall: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusActive: {
    backgroundColor: colors.green.tint,
  },
  statusBadgeTextSmall: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
  },
  routeBox: {
    marginTop: spacing[2],
    marginBottom: spacing[2],
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
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
    backgroundColor: colors.green.primary,
  },
  routeLine: {
    width: 2,
    height: 12,
    backgroundColor: colors.border.subtle,
    marginLeft: 3,
    marginVertical: 2,
  },
  routeText: {
    fontSize: 12,
    color: colors.ink[700],
    flex: 1,
  },
  fareBreakdownBox: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing[2],
    marginTop: spacing[1],
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    fontSize: 12,
    color: colors.ink[500],
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
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
    padding: spacing[4],
    width: '100%',
    maxWidth: 360,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.green.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  modalMessage: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    marginBottom: spacing[3],
  },
  modalDestBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.surface.muted,
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[4],
  },
  modalDestText: {
    flex: 1,
    fontSize: 12,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
  },
  modalActions: {
    gap: spacing[2],
  },
  modalPrimaryBtn: {
    minHeight: 48,
    width: '100%',
  },
  modalSecondaryBtn: {
    minHeight: 48,
    width: '100%',
  },
  reasonsList: {
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing[2],
  },
  reasonOptionSelected: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(235, 87, 87, 0.05)',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.ink[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.danger,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  reasonLabel: {
    fontSize: 12,
    color: colors.ink[700],
    flex: 1,
  },
  reasonLabelSelected: {
    fontWeight: typography.weight.bold,
    color: colors.danger,
  },
});
