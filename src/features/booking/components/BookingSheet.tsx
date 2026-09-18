import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator, Alert, TextInput } from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { useCreateBooking } from '@/features/booking/hooks/useCreateBooking';
import { useBookingDraftStore, routeMatchesInputs } from '@/stores/bookingDraftStore';
import { useLocationStore } from '@/stores/locationStore';
import { haversineMeters } from '@pakyaw/shared/lib/geo';
import { PICKUP_DISTANCE_WARNING_THRESHOLD_METERS } from '@/lib/serviceArea';
import { logger } from '@pakyaw/shared/lib/logger';
import { RideModeSelector } from './RideModeSelector';
import { OnboardingModal } from './OnboardingModal';
import { FareQuoteBreakdown } from './FareQuoteBreakdown';
import { useQuote } from '@/features/booking/hooks/useQuote';
import { useTransportConfig } from '@/features/booking/hooks/useTransportConfig';
import { toRideMode, type CreateBookingInput, type BookingRideSelection } from '../types';

type BookingSheetProps = {
  readonly onSearchPickup?: () => void;
  readonly onSearchDestination?: () => void;
  readonly isMinimized?: boolean;
  readonly onToggleMinimize?: () => void;
  readonly isLoadingRoute?: boolean;
};

const MODE_SUMMARY: Record<
  BookingRideSelection,
  {
    badge: string;
    title: string;
    description: string;
  }
> = {
  private: {
    badge: 'Pakyaw',
    title: 'Private Ride',
    description: 'Private ride for you and your group. Direct to your destination.',
  },
  shared: {
    badge: 'Shared',
    title: 'Pay Per Seat',
    description: 'Pay per seat. Other passengers along your route may share the ride.',
  },
};

export function BookingSheet({
  onSearchPickup,
  onSearchDestination,
  isMinimized = false,
  onToggleMinimize,
  isLoadingRoute = false,
}: BookingSheetProps) {
  const draft = useBookingDraftStore((s) => s.draft);
  const setPassengerCount = useBookingDraftStore((s) => s.setPassengerCount);
  const setDestination = useBookingDraftStore((s) => s.setDestination);
  const setRoute = useBookingDraftStore((s) => s.setRoute);
  const setRideMode = useBookingDraftStore((s) => s.setRideMode);
  const setBookingFor = useBookingDraftStore((s) => s.setBookingFor);
  const setRiderFirstName = useBookingDraftStore((s) => s.setRiderFirstName);
  const setPickupNote = useBookingDraftStore((s) => s.setPickupNote);

  const { config: transportConfig } = useTransportConfig();
  const sharedMaxSeats = transportConfig.modes.shared.maxSeatsPerBooking || 3;
  const soloMaxSeats = transportConfig.modes.solo.maxPassengers || transportConfig.vehicleCapacity || 6;
  const soloMinBilledSeats = transportConfig.modes.solo.minimumBilledSeats || 6;

  const [showInfoModal, setShowInfoModal] = useState(false);

  const { mutate, isPending } = useCreateBooking();
  const {
    quote,
    isLoading: isQuoteLoading,
    isError: isQuoteError,
    error: quoteError,
    refetch: refetchQuote,
  } = useQuote();

  const routeIsCurrent = routeMatchesInputs(draft);
  const currentRoute = routeIsCurrent ? draft.route : null;

  function handleBack() {
    logger.info('[BookingSheet] Back button tapped, clearing destination');
    setDestination(null);
    setRoute(null);
  }

  const confirmButtonLabel = React.useMemo(() => {
    if (draft.rideMode === 'shared') return 'Book Shared';
    return 'Book Pakyaw';
  }, [draft.rideMode]);

  function handleConfirm() {
    if (!draft.pickup || !draft.destination || !draft.route) {
      logger.error('[BookingSheet] Confirm tapped but pickup, destination, or route is missing');
      return;
    }

    if (!routeMatchesInputs(draft)) {
      logger.warn('[BookingSheet] Confirm tapped but route is stale for current inputs; ignoring');
      return;
    }

    if (draft.bookingFor === 'other' && !draft.riderFirstName.trim()) {
      Alert.alert('Rider Name Required', "Please enter the rider's first name.");
      return;
    }

    const payload: CreateBookingInput = {
      mode: toRideMode(draft.rideMode),
      pickup: draft.pickup!,
      destination: draft.destination!,
      passengerCount: draft.passengerCount,
      route: {
        distanceMeters: draft.route.distanceMeters,
        durationSeconds: draft.route.durationSeconds,
        polyline: draft.route.polyline,
      },
      displayedFare: quote?.fare.total ?? null,
      bookingFor: draft.bookingFor,
      ...(draft.bookingFor === 'other' && draft.riderFirstName.trim()
        ? { rider: { firstName: draft.riderFirstName.trim() } }
        : {}),
      ...(draft.pickupNote.trim() ? { pickupNote: draft.pickupNote.trim() } : {}),
    };

    // Pre-booking distance mismatch warning applies only for self-bookings
    if (draft.bookingFor === 'self') {
      const deviceLocation = useLocationStore.getState().location;
      let pickupDistanceMeters: number | null = null;
      if (deviceLocation && draft.pickup.coords) {
        pickupDistanceMeters = haversineMeters(
          { lat: deviceLocation.latitude, lng: deviceLocation.longitude },
          draft.pickup.coords
        );
      }

      if (pickupDistanceMeters != null && pickupDistanceMeters >= PICKUP_DISTANCE_WARNING_THRESHOLD_METERS) {
        const formattedDistance = pickupDistanceMeters >= 1000
          ? `${(pickupDistanceMeters / 1000).toFixed(1)} km`
          : `${Math.round(pickupDistanceMeters)} m`;

        Alert.alert(
          'Confirm Pickup Location',
          `This pickup is ${formattedDistance} from your current location. Is this where you want the Driver to meet you?`,
          [
            {
              text: 'Change Pickup',
              style: 'cancel',
              onPress: () => {
                if (onSearchPickup) {
                  onSearchPickup();
                }
              },
            },
            {
              text: 'Continue',
              onPress: () => {
                logger.info('[BookingSheet] Submitting trip booking request after distance confirmation', payload);
                mutate(payload);
              },
            },
          ]
        );
        return;
      }
    }

    logger.info('[BookingSheet] Submitting trip booking request', payload);
    mutate(payload);
  }

  const isRouteTooShort = !!currentRoute && currentRoute.distanceMeters < 50;

  // Formatting distance & duration
  const distanceKm = currentRoute
    ? (currentRoute.distanceMeters / 1000).toFixed(1)
    : '0.0';
  const durationMin = currentRoute
    ? Math.round(currentRoute.durationSeconds / 60)
    : 0;

  const hasValidRoute = !!currentRoute && !isRouteTooShort;
  const currentModeInfo = (draft.rideMode && MODE_SUMMARY[draft.rideMode]) || MODE_SUMMARY.private;

  return (
    <View style={styles.container} testID="booking-sheet">
      <OnboardingModal
        mode={draft.rideMode}
        isVisible={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        config={transportConfig}
      />

      {/* Route Header Card */}
      <View style={[styles.routeCard, shadow.card]}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
          accessibilityLabel="Go back"
          testID="booking-back-button"
        >
          <SymbolIcon name="chevron.left" size={20} tintColor={colors.ink[700]} />
        </Pressable>

        <View style={styles.routeDetails}>
          <Pressable
            onPress={onSearchPickup}
            style={({ pressed }) => [styles.routeRow, pressed && styles.buttonPressed]}
            accessibilityLabel="Change pickup location"
          >
            <View style={[styles.dot, styles.dotPickup]} />
            <View style={styles.placeText}>
              <Text style={styles.placePrefix}>From</Text>
              <Text style={styles.placeName} numberOfLines={1}>
                {draft.pickup?.label || 'Current Location'}
              </Text>
            </View>
          </Pressable>
          
          <View style={styles.routeLine} />

          <Pressable
            onPress={onSearchDestination}
            style={({ pressed }) => [
              styles.routeRow,
              pressed && styles.buttonPressed,
            ]}
            accessibilityLabel="Change destination location"
          >
            <View style={[
              styles.dot,
              styles.dotDestination,
              isRouteTooShort && styles.dotDestinationInvalid,
            ]} />
            <View style={styles.placeText}>
              <Text style={styles.placePrefix}>To</Text>
              <Text style={[
                styles.placeName,
                isRouteTooShort && styles.placeNameInvalid,
              ]} numberOfLines={1}>
                {draft.destination?.label || 'Select Destination'}
              </Text>
            </View>
            {isRouteTooShort ? (
              <SymbolIcon name="exclamationmark.triangle.fill" size={16} tintColor={colors.danger} />
            ) : (
              <Text style={styles.changeTextSmall}>CHANGE</Text>
            )}
          </Pressable>

          {isRouteTooShort && (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>Pickup and destination are too close.</Text>
            </View>
          )}
        </View>

        {onToggleMinimize && (
          <Pressable
            onPress={onToggleMinimize}
            style={({ pressed }) => [styles.minimizeButton, pressed && styles.buttonPressed]}
            accessibilityLabel={isMinimized ? "Expand booking sheet" : "Collapse booking sheet"}
            testID="booking-minimize-button"
          >
            <SymbolIcon
              name={isMinimized ? 'chevron.up' : 'chevron.down'}
              size={20}
              tintColor={colors.ink[700]}
            />
          </Pressable>
        )}
      </View>

      {/* Distance & ETA Pills Row or Loading Placeholder */}
      {!currentRoute ? (
        <View style={styles.skeletonContainer}>
          <View style={styles.skeletonRow}>
            <ActivityIndicator size="small" color={colors.blue.primary} />
            <Text style={{ color: colors.ink[500], fontSize: 12, marginLeft: 8 }}>Calculating route...</Text>
          </View>
        </View>
      ) : hasValidRoute ? (
        <View style={styles.pillsRow}>
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>DISTANCE</Text>
            <Text style={styles.pillValue}>{distanceKm} km</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>ESTIMATED TIME</Text>
            <Text style={styles.pillValue}>{durationMin} min</Text>
          </View>
        </View>
      ) : null}

      {/* Main Form Fields */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <RideModeSelector
          selectedMode={draft.rideMode}
          onSelectMode={(mode) => setRideMode(mode, sharedMaxSeats)}
        />

        {/* Selected Mode Context & Summary Card */}
        <View style={styles.modeSummaryCard}>
          <View style={styles.modeSummaryHeader}>
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>{currentModeInfo.badge}</Text>
            </View>
            <Pressable
              onPress={() => setShowInfoModal(true)}
              style={({ pressed }) => [styles.infoButton, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Learn more about ${currentModeInfo.badge} mode`}
            >
              <SymbolIcon name="info.circle" size={16} tintColor={colors.blue.primary} />
              <Text style={styles.infoButtonText}>Learn more</Text>
            </Pressable>
          </View>
          <Text style={styles.modeDescription}>{currentModeInfo.description}</Text>
        </View>

        {/* Rider / Seat Count Section */}
        <View style={styles.formGroup}>
            <View style={styles.formRow}>
              <View style={styles.labelContainer}>
                <Text style={styles.rowTitle}>
                  {draft.rideMode === 'private' ? 'How many riders?' : 'How many seats?'}
                </Text>
                <Text style={styles.rowSubtitle}>
                  {draft.rideMode === 'private'
                    ? `Reserves all ${soloMinBilledSeats} vehicle seats. Choose 1–${soloMaxSeats} actual riders.`
                    : `Cover 1 to ${sharedMaxSeats} seats on this route.`}
                </Text>
              </View>
              <View style={styles.stepperContainer}>
                <Pressable
                  onPress={() => setPassengerCount(draft.passengerCount - 1)}
                  disabled={draft.passengerCount <= 1}
                  style={({ pressed }) => [
                    styles.stepperButton,
                    draft.passengerCount <= 1 && styles.stepperDisabled,
                    pressed && styles.stepperPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease count"
                >
                  <Text style={styles.stepperButtonText}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{draft.passengerCount}</Text>
                <Pressable
                  onPress={() => setPassengerCount(draft.passengerCount + 1, draft.rideMode === 'shared' ? sharedMaxSeats : soloMaxSeats)}
                  disabled={draft.rideMode === 'shared' ? draft.passengerCount >= sharedMaxSeats : draft.passengerCount >= soloMaxSeats}
                  style={({ pressed }) => [
                    styles.stepperButton,
                    (draft.rideMode === 'shared' ? draft.passengerCount >= sharedMaxSeats : draft.passengerCount >= soloMaxSeats) && styles.stepperDisabled,
                    pressed && styles.stepperPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Increase count"
                >
                  <Text style={styles.stepperButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

        {/* Booking Ownership Section ("Who is this ride for?") */}
        <View style={styles.formGroup}>
          <Text style={styles.rowTitle}>Who is this ride for?</Text>
          <View style={styles.ownershipRow}>
            <Pressable
              style={[
                styles.ownershipOption,
                draft.bookingFor === 'self' && styles.ownershipOptionSelected,
              ]}
              onPress={() => setBookingFor('self')}
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.bookingFor === 'self' }}
              testID="booking-for-self-btn"
            >
              <View style={[styles.radioCircle, draft.bookingFor === 'self' && styles.radioCircleSelected]}>
                {draft.bookingFor === 'self' && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.ownershipLabel, draft.bookingFor === 'self' && styles.ownershipLabelSelected]}>
                Me
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.ownershipOption,
                draft.bookingFor === 'other' && styles.ownershipOptionSelected,
              ]}
              onPress={() => setBookingFor('other')}
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.bookingFor === 'other' }}
              testID="booking-for-other-btn"
            >
              <View style={[styles.radioCircle, draft.bookingFor === 'other' && styles.radioCircleSelected]}>
                {draft.bookingFor === 'other' && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.ownershipLabel, draft.bookingFor === 'other' && styles.ownershipLabelSelected]}>
                Someone else
              </Text>
            </Pressable>
          </View>

          {draft.bookingFor === 'other' && (
            <View style={styles.otherRiderContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {"Rider's first name"} <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Anna"
                  placeholderTextColor={colors.ink[400]}
                  value={draft.riderFirstName}
                  onChangeText={setRiderFirstName}
                  maxLength={100}
                  autoCapitalize="words"
                  testID="rider-first-name-input"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>Pickup note (optional)</Text>
                  <Text style={styles.charCountText}>{draft.pickupNote.length}/140</Text>
                </View>
                <TextInput
                  style={[styles.textInput, styles.noteInput]}
                  placeholder="e.g. Waiting near the pharmacy entrance"
                  placeholderTextColor={colors.ink[400]}
                  value={draft.pickupNote}
                  onChangeText={setPickupNote}
                  maxLength={140}
                  multiline
                  testID="pickup-note-input"
                />
                <Text style={styles.inputHelpText}>
                  Help the Driver know where to meet the rider.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Fare Quote Breakdown */}
        <View style={styles.detailsContainer}>
          <FareQuoteBreakdown
            quote={quote}
            isLoading={isQuoteLoading}
            isError={isQuoteError}
            error={quoteError}
            onRetry={refetchQuote}
            mode={draft.rideMode}
            hasValidRoute={hasValidRoute}
            riderCount={draft.passengerCount}
          />
        </View>
      </ScrollView>

      {/* Pickup Location Bar */}
      <View style={styles.pickupBar}>
        <View style={styles.pickupLeft}>
          <SymbolIcon name="mappin.circle.fill" size={18} tintColor={colors.blue.primary} style={styles.sparkleIcon} />
          <View style={styles.pickupTextColumn}>
            <Text style={styles.pickupLabel}>PICKUP POINT</Text>
            <Text style={styles.pickupValue} numberOfLines={1}>
              {draft.pickup?.label || 'Current Location'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onSearchPickup}
          style={({ pressed }) => [styles.changeButton, pressed && styles.buttonPressed]}
          accessibilityLabel="Change pickup"
          accessibilityRole="button"
        >
          <Text style={styles.changeText}>CHANGE</Text>
        </Pressable>
      </View>

      {/* Bottom Action Row */}
      <View style={styles.actionRow}>
        <View style={styles.cashCard}>
          <SymbolIcon name="banknote" size={18} tintColor={colors.green.primary} />
          <Text style={styles.cashText}>Cash</Text>
        </View>
        
        <View style={styles.buttonWrapper}>
          <Button
            label={confirmButtonLabel}
            onPress={handleConfirm}
            loading={isPending}
            disabled={isPending || !hasValidRoute || isLoadingRoute || isQuoteLoading || isQuoteError || !quote}
            testID="booking-confirm"
            style={styles.confirmButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.card,
    paddingTop: spacing[4],
  },
  scrollView: {
    flex: 1,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
    position: 'relative',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  minimizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[3],
  },
  buttonPressed: {
    opacity: 0.7,
  },
  routeDetails: {
    flex: 1,
    gap: spacing[1],
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  routeLine: {
    width: 1.5,
    height: 16,
    backgroundColor: colors.border.subtle,
    marginLeft: 13, // align with dots
    marginVertical: -2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotPickup: {
    backgroundColor: colors.blue.primary,
  },
  dotDestination: {
    backgroundColor: colors.amber.primary,
  },
  dotDestinationInvalid: {
    backgroundColor: colors.danger,
  },
  placeText: {
    flex: 1,
  },
  placePrefix: {
    fontSize: 10,
    fontWeight: typography.weight.semibold,
    color: colors.ink[400],
    textTransform: 'uppercase',
  },
  placeName: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
  },
  placeNameInvalid: {
    color: colors.danger,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  errorText: {
    fontSize: typography.size.bodySmall,
    color: colors.danger,
    fontWeight: typography.weight.semibold,
  },
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  pill: {
    flex: 1,
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  pillLabel: {
    fontSize: 9,
    fontWeight: typography.weight.semibold,
    color: colors.ink[400],
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  pillValue: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[700],
  },
  pickupTextColumn: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  modeSummaryCard: {
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  modeSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[1],
  },
  modeBadge: {
    backgroundColor: colors.blue.tint,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  infoButtonText: {
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    color: colors.blue.primary,
  },
  modeDescription: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    lineHeight: 18,
  },
  formGroup: {
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelContainer: {
    flex: 1,
    marginRight: spacing[3],
  },
  rowTitle: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  rowSubtitle: {
    fontSize: 11,
    color: colors.ink[500],
    marginTop: 2,
    lineHeight: 14,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDisabled: {
    opacity: 0.35,
  },
  stepperPressed: {
    opacity: 0.7,
  },
  stepperButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.ink[700],
  },
  stepperValue: {
    width: 32,
    textAlign: 'center',
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  detailsContainer: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  skeletonContainer: {
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    marginBottom: spacing[3],
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  changeTextSmall: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
  },
  pickupBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.muted,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  pickupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  sparkleIcon: {
    marginTop: 2,
  },
  pickupLabel: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.ink[500],
    letterSpacing: 0.8,
  },
  pickupValue: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    maxWidth: 200,
  },
  changeButton: {
    padding: spacing[1],
  },
  changeText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.card,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    gap: spacing[3],
  },
  cashCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    height: 48,
  },
  cashText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[700],
  },
  buttonWrapper: {
    flex: 1,
  },
  confirmButton: {
    height: 48,
    borderRadius: radius.md,
  },
  ownershipRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  ownershipOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.surface.card,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  ownershipOptionSelected: {
    borderColor: colors.blue.primary,
    backgroundColor: colors.blue.tint,
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
    borderColor: colors.blue.primary,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.blue.primary,
  },
  ownershipLabel: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.medium,
    color: colors.ink[700],
  },
  ownershipLabelSelected: {
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
  },
  otherRiderContainer: {
    marginTop: spacing[3],
    gap: spacing[3],
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  inputGroup: {
    gap: spacing[1],
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    color: colors.ink[700],
  },
  requiredStar: {
    color: colors.danger,
    fontWeight: typography.weight.bold,
  },
  charCountText: {
    fontSize: 10,
    fontWeight: typography.weight.medium,
    color: colors.ink[400],
  },
  textInput: {
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: typography.size.bodySmall,
    color: colors.ink[900],
  },
  noteInput: {
    minHeight: 52,
    textAlignVertical: 'top',
  },
  inputHelpText: {
    fontSize: 11,
    color: colors.ink[500],
    marginTop: 2,
  },
});
