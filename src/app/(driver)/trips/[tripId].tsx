import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useTripDetail } from '@pakyaw/shared/features/trip-history/hooks/useTripDetail';
import { formatPhp } from '@pakyaw/shared/features/trip-history/services/earnings.service';
import type { Timestamp, TripDetail } from '@pakyaw/shared/features/trip-history/types';

type FareValue = {
  readonly driverEarnings?: unknown;
  readonly driverFare?: unknown;
  readonly total?: unknown;
  readonly techFee?: unknown;
  readonly serviceFee?: unknown;
};

function getRawFare(trip: TripDetail): FareValue | null {
  const candidate = trip.fareBreakdown ?? (typeof trip.fare === 'object' ? trip.fare : null);
  return typeof candidate === 'object' && candidate !== null ? candidate : null;
}

function formatTripDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  const date = ts.toDate?.() ?? (typeof ts.seconds === 'number' ? new Date(ts.seconds * 1000) : null);
  if (!date) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDistanceKm(meters: number | null | undefined): string {
  if (typeof meters !== 'number' || meters <= 0 || !Number.isFinite(meters)) {
    return '—';
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

export default function DriverTripDetailsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip, isLoading, isError, error, refetch } = useTripDetail(tripId);

  const isCompleted = trip?.status === 'completed';
  const isShared = trip?.mode === 'shared';

  const driverEarnings = useMemo(() => {
    if (!trip) return null;
    const rawFare = getRawFare(trip);
    if (typeof rawFare?.driverEarnings === 'number') {
      return rawFare.driverEarnings;
    }
    if (typeof rawFare?.driverFare === 'number') {
      return rawFare.driverFare;
    }
    return null;
  }, [trip]);

  const passengerTotal = useMemo(() => {
    if (!trip) return null;
    const rawFare = getRawFare(trip);
    if (typeof rawFare?.total === 'number') {
      return rawFare.total;
    }
    if (typeof trip.fare === 'number') {
      return trip.fare;
    }
    return null;
  }, [trip]);

  const serviceFee = useMemo(() => {
    if (!trip) return null;
    const rawFare = getRawFare(trip);
    if (typeof rawFare?.techFee === 'number') {
      return rawFare.techFee;
    }
    if (typeof rawFare?.serviceFee === 'number') {
      return rawFare.serviceFee;
    }
    return null;
  }, [trip]);

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => (typeof router.canGoBack === 'function' && router.canGoBack() ? router.back() : router.replace('./activity'))}
          accessibilityRole="button"
          accessibilityLabel="Back to Activity"
        >
          <SymbolIcon name="chevron.left" size={20} tintColor={colors.blue.primary} />
          <Text style={styles.backButtonText}>Activity</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Trip Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.green.primary} />
          <Text style={styles.loadingText}>Loading trip details...</Text>
        </View>
      ) : isError || !trip ? (
        <View style={styles.centerContainer}>
          <SymbolIcon name="exclamationmark.triangle.fill" size={36} tintColor={colors.danger} />
          <Text style={styles.errorTitle}>Trip Not Found</Text>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Unable to load details for this trip.'}
          </Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Summary / Status Card */}
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View>
                <Text style={styles.sectionLabel}>Ride Mode</Text>
                <Text style={styles.primaryValue}>{isShared ? 'Shared' : 'Pakyaw'}</Text>
              </View>
              <View style={[styles.statusBadge, isCompleted ? styles.completedBadge : styles.cancelledBadge]}>
                <Text style={[styles.statusBadgeText, isCompleted ? styles.completedBadgeText : styles.cancelledBadgeText]}>
                  {isCompleted ? 'COMPLETED' : 'CANCELLED'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date & Time</Text>
              <Text style={styles.metaValue}>
                {formatTripDate(trip.completedAt ?? trip.cancelledAt ?? trip.requestedAt)}
              </Text>
            </View>
          </View>

          {/* Route Card */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Route</Text>
            <View style={styles.routeContainer}>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, styles.pickupDot]} />
                <View style={styles.routeTextCol}>
                  <Text style={styles.routeSublabel}>Pickup</Text>
                  <Text style={styles.routeMainText}>{trip.pickup.label ?? '—'}</Text>
                </View>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, styles.destDot]} />
                <View style={styles.routeTextCol}>
                  <Text style={styles.routeSublabel}>Destination</Text>
                  <Text style={styles.routeMainText}>{trip.destination.label ?? '—'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Trip distance</Text>
              <Text style={styles.metaValue}>
                {formatDistanceKm(trip.route?.distanceMeters ?? trip.driverRoute?.distanceMeters)}
              </Text>
            </View>
          </View>

          {/* Rider & Passenger Card */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Rider & Booking</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Rider</Text>
              <Text style={styles.metaValue}>{trip.rider?.firstName ?? 'Passenger'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Passengers</Text>
              <Text style={styles.metaValue}>{trip.passengerCount ?? 1}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Seats</Text>
              <Text style={styles.metaValue}>{trip.billedSeats ?? trip.passengerCount ?? 1}</Text>
            </View>
          </View>

          {/* Fare Breakdown Card */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Fare Breakdown</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Passenger Total</Text>
              <Text style={styles.metaValue}>{formatPhp(passengerTotal)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Pakyaw Service Fee</Text>
              <Text style={styles.metaValue}>{formatPhp(serviceFee)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.metaRow}>
              <Text style={styles.earningsHighlightLabel}>Driver Earnings</Text>
              <Text style={styles.earningsHighlightValue}>
                {isCompleted && typeof driverEarnings === 'number'
                  ? formatPhp(driverEarnings)
                  : 'No earnings recorded'}
              </Text>
            </View>
          </View>

          {/* Cancellation Info if cancelled */}
          {trip.status === 'cancelled' ? (
            <View style={[styles.card, styles.cancellationCard]}>
              <Text style={styles.cancellationTitle}>Cancellation Details</Text>
              {trip.cancelledBy ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Cancelled by</Text>
                  <Text style={styles.metaValue}>
                    {trip.cancelledBy === 'driver' ? 'Driver' : 'Passenger'}
                  </Text>
                </View>
              ) : null}
              {trip.cancelReason ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Reason</Text>
                  <Text style={styles.metaValue}>{trip.cancelReason.replace(/_/g, ' ')}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.bgLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    backgroundColor: colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    minHeight: 44,
  },
  backButtonText: {
    fontSize: 15,
    fontFamily: typography.family.semibold,
    color: colors.blue.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    padding: spacing[4],
    gap: spacing[3],
    paddingBottom: spacing[8],
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: typography.family.medium,
    color: colors.ink[500],
  },
  primaryValue: {
    fontSize: 18,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: typography.family.bold,
    letterSpacing: 0.5,
  },
  completedBadge: {
    backgroundColor: colors.green.tint,
  },
  completedBadgeText: {
    color: colors.green.primary,
  },
  cancelledBadge: {
    backgroundColor: colors.dangerSubtle,
  },
  cancelledBadgeText: {
    color: colors.danger,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    marginBottom: spacing[3],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing[3],
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  metaLabel: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
  },
  metaValue: {
    fontSize: 15,
    fontFamily: typography.family.semibold,
    color: colors.ink[900],
  },
  earningsHighlightLabel: {
    fontSize: 16,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  earningsHighlightValue: {
    fontSize: 20,
    fontFamily: typography.family.bold,
    color: colors.green.primary,
  },
  routeContainer: {
    paddingVertical: 2,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  pickupDot: {
    backgroundColor: colors.blue.primary,
  },
  destDot: {
    backgroundColor: colors.green.primary,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: colors.border.subtle,
    marginLeft: 4,
    marginVertical: 2,
  },
  routeTextCol: {
    flex: 1,
  },
  routeSublabel: {
    fontSize: 11,
    fontFamily: typography.family.regular,
    color: colors.ink[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeMainText: {
    fontSize: 15,
    fontFamily: typography.family.medium,
    color: colors.ink[900],
    marginTop: 1,
  },
  cancellationCard: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  cancellationTitle: {
    fontSize: 15,
    fontFamily: typography.family.bold,
    color: colors.danger,
    marginBottom: spacing[2],
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  loadingText: {
    fontSize: 15,
    fontFamily: typography.family.medium,
    color: colors.ink[500],
    marginTop: spacing[3],
  },
  errorTitle: {
    fontSize: 17,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    marginTop: spacing[3],
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  retryButton: {
    backgroundColor: colors.blue.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: typography.family.bold,
  },
});
