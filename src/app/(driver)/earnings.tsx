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
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useDriverAllCompletedTrips } from '@pakyaw/shared/features/trip-history/hooks/useDriverTripHistory';
import {
  computeDriverEarningsSummary,
  formatPhp,
} from '@pakyaw/shared/features/trip-history/services/earnings.service';
import {
  NetworkError,
  PermissionError,
  QueryIndexError,
  TripHistoryServiceError,
} from '@pakyaw/shared/features/trip-history/errors';
import type { TripHistoryItem } from '@pakyaw/shared/features/trip-history/types';
import { auth } from '@/services/firebase/firebase';

/**
 * Returns a safe, user-facing message for an earnings load error.
 */
function getEarningsErrorMessage(err: unknown): string {
  if (err instanceof QueryIndexError || err instanceof TripHistoryServiceError) {
    return 'Earnings are temporarily unavailable. Please try again shortly.';
  }
  if (err instanceof NetworkError) {
    return 'Network error — please check your connection and try again.';
  }
  if (err instanceof PermissionError) {
    return 'You do not have permission to view earnings.';
  }
  return 'Unable to load earnings. Please try again.';
}

function formatTripDate(ts: TripHistoryItem['completedAt'] | TripHistoryItem['requestedAt']): string {
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

function RecentTripRow({ trip }: { readonly trip: TripHistoryItem }) {
  const isShared = trip.mode === 'shared';
  const earnings = typeof trip.driverEarnings === 'number' ? formatPhp(trip.driverEarnings) : '—';
  const time = formatTripDate(trip.completedAt ?? trip.requestedAt);

  return (
    <Pressable
      style={({ pressed }) => [styles.tripRow, pressed && styles.tripRowPressed]}
      onPress={() => router.push({ pathname: './trips/[tripId]', params: { tripId: trip.tripId } })}
      accessibilityRole="button"
      accessibilityLabel={`Trip to ${trip.destination.label}`}
    >
      <View style={styles.tripRowLeft}>
        <View style={styles.tripRowBadgeRow}>
          <View style={[styles.modeBadge, isShared ? styles.sharedBadge : styles.pakyawBadge]}>
            <Text style={[styles.modeBadgeText, isShared ? styles.sharedBadgeText : styles.pakyawBadgeText]}>
              {isShared ? 'Shared' : 'Pakyaw'}
            </Text>
          </View>
          <Text style={styles.tripRowDate}>{time}</Text>
        </View>
        <Text style={styles.tripRowRoute} numberOfLines={1}>
          {trip.pickup.label} → {trip.destination.label}
        </Text>
      </View>
      <View style={styles.tripRowRight}>
        <Text style={styles.tripRowEarnings}>{earnings}</Text>
        <SymbolIcon name="chevron.right" size={14} tintColor={colors.ink[400]} />
      </View>
    </Pressable>
  );
}

export default function EarningsScreen() {
  const uid = auth.currentUser?.uid;
  const { data, isLoading, isError, error, refetch, isRefetching } = useDriverAllCompletedTrips(uid);

  const trips = useMemo(() => data?.trips ?? [], [data]);

  const summary = useMemo(() => {
    return computeDriverEarningsSummary(trips);
  }, [trips]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Earnings</Text>
        <Text style={styles.headerSubtitle}>Authoritative Driver earnings from completed trips</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.green.primary} />
          <Text style={styles.loadingText}>Loading earnings summary...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <SymbolIcon name="exclamationmark.triangle.fill" size={36} tintColor={colors.danger} />
          <Text style={styles.errorTitle}>Unable to load earnings</Text>
          <Text style={styles.errorText}>
            {getEarningsErrorMessage(error)}
          </Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : summary.completedCount === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <SymbolIcon name="banknote" size={32} tintColor={colors.ink[400]} />
          </View>
          <Text style={styles.emptyTitle}>No completed-trip earnings yet</Text>
          <Text style={styles.emptySubtitle}>Completed trips will generate authoritative earnings records.</Text>
        </View>
      ) : (
        <FlatList
          data={summary.recentTrips}
          keyExtractor={(item) => item.tripId}
          renderItem={({ item }) => <RecentTripRow trip={item} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={
            <View style={styles.summaryContainer}>
              {/* Today Hero Card */}
              <View style={styles.heroCard}>
                <Text style={styles.heroCardLabel}>Today</Text>
                <Text style={styles.heroCardAmount}>{formatPhp(summary.today)}</Text>
              </View>

              {/* 7 Days & 30 Days Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statCardLabel}>7 Days</Text>
                  <Text style={styles.statCardAmount}>{formatPhp(summary.last7Days)}</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statCardLabel}>30 Days</Text>
                  <Text style={styles.statCardAmount}>{formatPhp(summary.last30Days)}</Text>
                </View>
              </View>

              {/* Completed Trips Counter */}
              <View style={styles.completedCard}>
                <Text style={styles.completedCardLabel}>Completed trips</Text>
                <Text style={styles.completedCardValue}>{summary.completedCount}</Text>
              </View>

              {/* Secondary concise notice */}
              <View style={styles.noticeBox}>
                <SymbolIcon name="info.circle" size={16} tintColor={colors.ink[500]} />
                <Text style={styles.noticeText}>
                  Earnings are based on completed trips.
                </Text>
              </View>

              <Text style={styles.sectionHeader}>Recent earnings</Text>
            </View>
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
    fontSize: 24,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    marginTop: 2,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  summaryContainer: {
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  heroCard: {
    backgroundColor: colors.green.primary,
    borderRadius: radius.md,
    padding: spacing[5],
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  heroCardLabel: {
    fontSize: 14,
    fontFamily: typography.family.bold,
    color: '#E3F6EC',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroCardAmount: {
    fontSize: 34,
    fontFamily: typography.family.bold,
    color: colors.white,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  statCardLabel: {
    fontSize: 13,
    fontFamily: typography.family.medium,
    color: colors.ink[500],
  },
  statCardAmount: {
    fontSize: 20,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    marginTop: 4,
  },
  completedCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    minHeight: 48,
  },
  completedCardLabel: {
    fontSize: 15,
    fontFamily: typography.family.medium,
    color: colors.ink[700],
  },
  completedCardValue: {
    fontSize: 18,
    fontFamily: typography.family.bold,
    color: colors.green.primary,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface.muted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
  },
  sectionHeader: {
    fontSize: 17,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    marginTop: spacing[2],
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.card,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing[2],
    minHeight: 52,
  },
  tripRowPressed: {
    backgroundColor: '#F8FAFC',
  },
  tripRowLeft: {
    flex: 1,
    marginRight: spacing[3],
  },
  tripRowBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  modeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modeBadgeText: {
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
  tripRowDate: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
  },
  tripRowRoute: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.ink[900],
  },
  tripRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripRowEarnings: {
    fontSize: 16,
    fontFamily: typography.family.bold,
    color: colors.green.primary,
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
    fontSize: 18,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    textAlign: 'center',
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
