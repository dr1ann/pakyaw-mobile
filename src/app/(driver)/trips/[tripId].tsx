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
import { colors, spacing, typography } from '@/constants/theme';
import { useTripDetail } from '@pakyaw/shared/features/trip-history/hooks/useTripDetail';
import { formatPhp } from '@pakyaw/shared/features/trip-history/services/earnings.service';

function formatTripDate(ts: any): string {
  if (!ts) return '—';
  const date = ts.toDate?.() ?? (ts.seconds ? new Date(ts.seconds * 1000) : null);
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
    const rawFare = (trip.fareBreakdown ?? (typeof trip.fare === 'object' ? trip.fare : null)) as any;
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
    const rawFare = (trip.fareBreakdown ?? (typeof trip.fare === 'object' ? trip.fare : null)) as any;
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
    const rawFare = (trip.fareBreakdown ?? (typeof trip.fare === 'object' ? trip.fare : null)) as any;
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
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to Trips"
        >
          <SymbolIcon name="chevron.left" size={20} tintColor={colors.blue.primary} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Trip Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.blue.primary} />
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
        <ScrollView contentContainerStyle={styles.content}>
          {/* Status & Mode Card */}
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View>
                <Text style={styles.sectionLabel}>Ride Mode</Text>
                <Text style={styles.primaryValue}>{isShared ? 'Shared' : 'Pakyaw'}</Text>
              </View>
              <View style={[styles.statusBadge, isCompleted ? styles.completedBadge : styles.cancelledBadge]}>
                <Text style={[styles.statusBadgeText, isCompleted ? styles.completedBadgeText : styles.cancelledBadgeText]}>
                  {isCompleted ? 'Completed' : 'Cancelled'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date</Text>
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
              <Text style={styles.metaLabel}>Distance</Text>
              <Text style={styles.metaValue}>
                {formatDistanceKm(trip.route?.distanceMeters ?? trip.driverRoute?.distanceMeters)}
              </Text>
            </View>
          </View>

          {/* Passenger & Seats Card */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Passenger & Booking</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Rider</Text>
              <Text style={styles.metaValue}>{trip.rider?.firstName ?? '—'}</Text>
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
                  : '—'}
              </Text>
            </View>
          </View>

          {/* Cancellation Card (if cancelled) */}
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
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 15,
    fontFamily: typography.family.medium,
    color: colors.blue.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  headerSpacer: {
    width: 50,
  },
  content: {
    padding: spacing[4],
    gap: spacing[3],
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: 12,
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
    fontFamily: typography.family.regular,
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
    fontSize: 12,
    fontFamily: typography.family.bold,
    textTransform: 'uppercase',
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
    fontSize: 15,
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
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
  },
  metaValue: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.ink[900],
  },
  earningsHighlightLabel: {
    fontSize: 15,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  earningsHighlightValue: {
    fontSize: 18,
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
    marginTop: 4,
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
  },
  routeMainText: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.ink[900],
    marginTop: 1,
  },
  cancellationCard: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  cancellationTitle: {
    fontSize: 14,
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
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.ink[500],
    marginTop: spacing[3],
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    marginTop: spacing[3],
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
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
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: typography.family.bold,
  },
});
