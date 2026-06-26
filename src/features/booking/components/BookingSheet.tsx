import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';

import { Button } from '@/components/ui/Button';
import { SymbolIcon } from '@/components/ui/SymbolIcon';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { useCreateBooking } from '@/features/booking/hooks/useCreateBooking';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { logger } from '@/lib/logger';

type BookingSheetProps = {
  readonly onSearchPickup?: () => void;
  readonly onSearchDestination?: () => void;
  readonly isMinimized?: boolean;
  readonly onToggleMinimize?: () => void;
};

export function BookingSheet({
  onSearchPickup,
  onSearchDestination,
  isMinimized = false,
  onToggleMinimize,
}: BookingSheetProps) {
  const draft = useBookingDraftStore((s) => s.draft);
  const setPassengerCount = useBookingDraftStore((s) => s.setPassengerCount);
  const setDestination = useBookingDraftStore((s) => s.setDestination);
  const setRoute = useBookingDraftStore((s) => s.setRoute);

  const { mutate, isPending } = useCreateBooking();

  function handleBack() {
    logger.info('[BookingSheet] Back button tapped, clearing destination');
    // Clear destination to return to search / home state
    setDestination(null);
    setRoute(null);
  }

  function handleConfirm() {
    if (!draft.pickup || !draft.destination || !draft.route) {
      logger.error('[BookingSheet] Confirm tapped but pickup, destination, or route is missing');
      return;
    }

    const payload = {
      pickup: draft.pickup,
      destination: draft.destination,
      passengerCount: draft.passengerCount,
      route: {
        distanceMeters: draft.route.distanceMeters,
        durationSeconds: draft.route.durationSeconds,
        polyline: draft.route.polyline,
      },
    };

    logger.info('[BookingSheet] Submitting trip booking request', payload);
    mutate(payload);
  }

  // Formatting distance & duration
  const distanceKm = draft.route
    ? (draft.route.distanceMeters / 1000).toFixed(1)
    : '0.0';
  const durationMin = draft.route
    ? Math.round(draft.route.durationSeconds / 60)
    : 0;

  const hasValidRoute = !!draft.route;

  return (
    <View style={styles.container} testID="booking-sheet">
      {/* Route Header Card */}
      <View style={[styles.routeCard, shadow.card]}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
          accessibilityLabel="Go back"
          testID="booking-back-button"
        >
          <SymbolIcon name="chevron.left" size={20} tintColor={colors.ink[800]} />
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
            style={({ pressed }) => [styles.routeRow, pressed && styles.buttonPressed]}
            accessibilityLabel="Change destination location"
          >
            <View style={[styles.dot, styles.dotDestination]} />
            <View style={styles.placeText}>
              <Text style={styles.placePrefix}>To</Text>
              <Text style={styles.placeName} numberOfLines={1}>
                {draft.destination?.label || 'Select Destination'}
              </Text>
            </View>
          </Pressable>
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
              tintColor={colors.ink[800]}
            />
          </Pressable>
        )}
      </View>

      {/* Distance & ETA Pills Row */}
      {hasValidRoute && (
        <View style={styles.pillsRow}>
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>DISTANCE</Text>
            <Text style={styles.pillValue}>{distanceKm} km</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>TIME</Text>
            <Text style={styles.pillValue}>{durationMin} min</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>TRAFFIC</Text>
            <View style={styles.trafficValueRow}>
              <View style={styles.trafficGreenDot} />
              <Text style={styles.pillValue}>Light</Text>
            </View>
          </View>
        </View>
      )}

      {/* Main Form Fields */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Mode Label */}
        <View style={styles.modeContainer}>
          <View style={styles.modeBadge}>
            <Text style={styles.modeText}>Pakyaw (Solo)</Text>
          </View>
          <Text style={styles.modeSubText}>
            Capacity buyout · min 4 seats. Driver gets the full base rate.
          </Text>
        </View>

        {/* Stepper & Toggles Group */}
        <View style={styles.formGroup}>
          {/* Passenger Stepper */}
          <View style={styles.formRow}>
            <View style={styles.labelContainer}>
              <Text style={styles.rowTitle}>Passengers boarding</Text>
              <Text style={styles.rowSubtitle}>Min 4-seat buyout enforced</Text>
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
                accessibilityLabel="Decrease passenger count"
              >
                <Text style={styles.stepperButtonText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{draft.passengerCount}</Text>
              <Pressable
                onPress={() => setPassengerCount(draft.passengerCount + 1)}
                disabled={draft.passengerCount >= 6}
                style={({ pressed }) => [
                  styles.stepperButton,
                  draft.passengerCount >= 6 && styles.stepperDisabled,
                  pressed && styles.stepperPressed,
                ]}
                accessibilityLabel="Increase passenger count"
              >
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

        </View>

        {/* Placeholder Details Container */}
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsHeader}>HOW THIS IS CALCULATED</Text>
          <View style={styles.placeholderCard}>
            <SymbolIcon name="info.circle" size={16} tintColor={colors.ink[500]} style={styles.infoIcon} />
            <Text style={styles.placeholderText}>
              Rate details will be calculated and displayed upon driver confirmation. No amount is required to request.
            </Text>
          </View>
          {/* Skeleton Loader representing the rows */}
          <View style={styles.skeletonContainer}>
            <View style={styles.skeletonRow}>
              <View style={[styles.skeletonPill, { width: '60%' }]} />
              <View style={[styles.skeletonPill, { width: '20%' }]} />
            </View>
            <View style={styles.skeletonRow}>
              <View style={[styles.skeletonPill, { width: '40%' }]} />
              <View style={[styles.skeletonPill, { width: '15%' }]} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Smart Pickup Container */}
      <View style={styles.pickupBar}>
        <View style={styles.pickupLeft}>
          <SymbolIcon name="sparkles" size={16} tintColor={colors.amber.primary} style={styles.sparkleIcon} />
          <View>
            <Text style={styles.pickupLabel}>SMART PICKUP</Text>
            <Text style={styles.pickupValue} numberOfLines={1}>
              {draft.pickup?.label || 'Verifying location...'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onSearchPickup}
          style={({ pressed }) => [styles.changeButton, pressed && styles.buttonPressed]}
          accessibilityLabel="Change pickup"
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
            label="Request Pakyaw"
            onPress={handleConfirm}
            loading={isPending}
            disabled={isPending || !hasValidRoute}
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
    backgroundColor: colors.border,
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
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
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
    color: colors.ink[800],
  },
  trafficValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trafficGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green.primary,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  modeContainer: {
    marginBottom: spacing[4],
  },
  modeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.blue.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    marginBottom: spacing[2],
  },
  modeText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
  },
  modeSubText: {
    fontSize: typography.size.bodySmall - 1,
    color: colors.ink[500],
    lineHeight: 16,
  },
  formGroup: {
    backgroundColor: colors.surface.muted,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[4],
    marginBottom: spacing[5],
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
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
  },
  rowSubtitle: {
    fontSize: typography.size.bodySmall - 1,
    color: colors.ink[500],
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
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
    opacity: 0.4,
  },
  stepperPressed: {
    opacity: 0.7,
  },
  stepperButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.ink[800],
  },
  stepperValue: {
    width: 36,
    textAlign: 'center',
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  detailsContainer: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  detailsHeader: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.ink[500],
    letterSpacing: 0.8,
  },
  placeholderCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    padding: spacing[3],
    gap: spacing[2],
  },
  infoIcon: {
    marginTop: 2,
  },
  placeholderText: {
    flex: 1,
    fontSize: typography.size.bodySmall,
    color: colors.ink[600],
    lineHeight: 16,
  },
  skeletonContainer: {
    gap: spacing[3],
    paddingHorizontal: spacing[2],
    paddingTop: spacing[2],
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skeletonPill: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    opacity: 0.5,
  },
  pickupBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.muted,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
    paddingVertical: spacing[4],
    backgroundColor: colors.surface.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
    height: 52,
  },
  cashText: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    color: colors.ink[800],
  },
  buttonWrapper: {
    flex: 1,
  },
  confirmButton: {
    height: 52,
    borderRadius: radius.md,
  },
});
