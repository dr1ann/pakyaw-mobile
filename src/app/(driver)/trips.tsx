import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, spacing, typography } from '@/constants/theme';
import { useDriverTripHistory } from '@pakyaw/shared/features/trip-history/hooks/useDriverTripHistory';
import { formatPhp } from '@pakyaw/shared/features/trip-history/services/earnings.service';
import {
  NetworkError,
  PermissionError,
  QueryIndexError,
  TripHistoryServiceError,
} from '@pakyaw/shared/features/trip-history/errors';
import type { TripHistoryItem } from '@pakyaw/shared/features/trip-history/types';
import { auth } from '@/services/firebase/firebase';

/**
 * Returns a safe, user-facing message for a trip history error.
 * Never exposes raw Firebase error messages, index URLs, or stack internals.
 */
function getTripHistoryErrorMessage(err: unknown): string {
  if (err instanceof QueryIndexError || err instanceof TripHistoryServiceError) {
    return 'Trip history is temporarily unavailable. Please try again shortly.';
  }
  if (err instanceof NetworkError) {
    return 'Network error \u2014 please check your connection and try again.';
  }
  if (err instanceof PermissionError) {
    return 'You do not have permission to view this history.';
  }
  return 'Unable to load trips. Please try again.';
}

function formatTripDateTime(ts: TripHistoryItem['completedAt'] | TripHistoryItem['requestedAt']): string {
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

function TripCard({ trip }: { readonly trip: TripHistoryItem }) {
  const isCompleted = trip.status === 'completed';
  const isShared = trip.mode === 'shared';
  const formattedTime = formatTripDateTime(trip.completedAt ?? trip.cancelledAt ?? trip.requestedAt);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: './trips/[tripId]', params: { tripId: trip.tripId } })}
      accessibilityRole="button"
      accessibilityLabel={`Trip to ${trip.destination.label}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, isShared ? styles.sharedBadge : styles.pakyawBadge]}>
            <Text style={[styles.badgeText, isShared ? styles.sharedBadgeText : styles.pakyawBadgeText]}>
              {isShared ? 'Shared' : 'Pakyaw'}
            </Text>
          </View>
          {isShared && trip.billedSeats && trip.billedSeats > 1 ? (
            <View style={[styles.badge, styles.seatBadge]}>
              <Text style={styles.seatBadgeText}>{trip.billedSeats} seats</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.badge, isCompleted ? styles.completedBadge : styles.cancelledBadge]}>
          <Text style={[styles.badgeText, isCompleted ? styles.completedBadgeText : styles.cancelledBadgeText]}>
            {isCompleted ? 'Completed' : 'Cancelled'}
          </Text>
        </View>
      </View>

      <Text style={styles.timestampText}>{formattedTime}</Text>

      <View style={styles.routeContainer}>
        <View style={styles.routeRow}>
          <View style={[styles.routeDot, styles.pickupDot]} />
          <Text style={styles.routeText} numberOfLines={1}>
            {trip.pickup.label}
          </Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routeRow}>
          <View style={[styles.routeDot, styles.destDot]} />
          <Text style={styles.routeText} numberOfLines={1}>
            {trip.destination.label}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.earningsLabel}>Driver earnings</Text>
          <Text style={styles.earningsValue}>
            {isCompleted && typeof trip.driverEarnings === 'number'
              ? formatPhp(trip.driverEarnings)
              : '—'}
          </Text>
        </View>

        <View style={styles.viewButton}>
          <Text style={styles.viewButtonText}>View Trip</Text>
          <SymbolIcon name="chevron.right" size={14} tintColor={colors.blue.primary} />
        </View>
      </View>
    </Pressable>
  );
}

export default function MyTripsScreen() {
  const uid = auth.currentUser?.uid;
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useDriverTripHistory(uid);

  const trips = useMemo(() => {
    return data?.pages.flatMap((page) => page.trips) ?? [];
  }, [data]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Trips</Text>
        <Text style={styles.headerSubtitle}>Past completed and cancelled trip records</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.blue.primary} />
          <Text style={styles.loadingText}>Loading trip history...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <SymbolIcon name="exclamationmark.triangle.fill" size={36} tintColor={colors.danger} />
          <Text style={styles.errorTitle}>Unable to load trips</Text>
          <Text style={styles.errorText}>
            {getTripHistoryErrorMessage(error)}
          </Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <SymbolIcon name="clock" size={32} tintColor={colors.ink[400]} />
          </View>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptySubtitle}>Completed and cancelled trips will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.tripId}
          renderItem={({ item }) => <TripCard trip={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.blue.primary} />
              </View>
            ) : null
          }
        />
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
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    backgroundColor: colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    marginTop: 2,
  },
  listContent: {
    padding: spacing[4],
    gap: spacing[3],
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: 12,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.9,
    backgroundColor: '#F8FAFC',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: typography.family.bold,
    textTransform: 'uppercase',
  },
  pakyawBadge: {
    backgroundColor: colors.blue.tint,
  },
  pakyawBadgeText: {
    color: colors.blue.primary,
  },
  sharedBadge: {
    backgroundColor: colors.cyan.tint,
  },
  sharedBadgeText: {
    color: colors.cyan.deep,
  },
  seatBadge: {
    backgroundColor: colors.surface.bgLight,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  seatBadgeText: {
    fontSize: 11,
    fontFamily: typography.family.medium,
    color: colors.ink[700],
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
  timestampText: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.ink[400],
    marginTop: 6,
    marginBottom: 10,
  },
  routeContainer: {
    paddingVertical: 4,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pickupDot: {
    backgroundColor: colors.blue.primary,
  },
  destDot: {
    backgroundColor: colors.green.primary,
  },
  routeLine: {
    width: 2,
    height: 14,
    backgroundColor: colors.border.subtle,
    marginLeft: 3,
    marginVertical: 2,
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.ink[900],
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  earningsLabel: {
    fontSize: 11,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
  },
  earningsValue: {
    fontSize: 16,
    fontFamily: typography.family.bold,
    color: colors.green.primary,
    marginTop: 1,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewButtonText: {
    fontSize: 13,
    fontFamily: typography.family.medium,
    color: colors.blue.primary,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    textAlign: 'center',
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
  footerLoader: {
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
});
