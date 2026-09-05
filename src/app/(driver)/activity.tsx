import { useEffect, useMemo, useState } from 'react';
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
import { useDriverTripHistory } from '@pakyaw/shared/features/trip-history/hooks/useDriverTripHistory';
import { formatPhp } from '@pakyaw/shared/features/trip-history/services/earnings.service';
import {
  NetworkError,
  PermissionError,
  QueryIndexError,
  TripHistoryServiceError,
} from '@pakyaw/shared/features/trip-history/errors';
import type { TripHistoryItem } from '@pakyaw/shared/features/trip-history/types';
import { auth, collection, firestore, onSnapshot, query, where } from '@/services/firebase/firebase';

/**
 * Returns a safe, user-facing message for a trip history error.
 */
function getTripHistoryErrorMessage(err: unknown): string {
  if (err instanceof QueryIndexError || err instanceof TripHistoryServiceError) {
    return 'Trip history is temporarily unavailable. Please try again shortly.';
  }
  if (err instanceof NetworkError) {
    return 'Network error — please check your connection and try again.';
  }
  if (err instanceof PermissionError) {
    return 'You do not have permission to view this history.';
  }
  return 'Unable to load trips. Please try again.';
}

function formatTripDateTime(ts: TripHistoryItem['completedAt'] | TripHistoryItem['cancelledAt'] | TripHistoryItem['requestedAt']): string {
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
      onPress={() => router.push(`/(driver)/trips/${trip.tripId}` as any)}
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
            {isCompleted ? 'COMPLETED' : 'CANCELLED'}
          </Text>
        </View>
      </View>

      <Text style={styles.timestampText}>{formattedTime}</Text>

      {/* Route Hierarchy */}
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

      {/* Footer with Earnings & Action */}
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.earningsLabel}>Driver earnings</Text>
          {isCompleted && typeof trip.driverEarnings === 'number' ? (
            <Text style={styles.earningsValue}>
              {formatPhp(trip.driverEarnings)}
            </Text>
          ) : (
            <Text style={styles.noEarningsValue}>
              No earnings recorded
            </Text>
          )}
        </View>

        <View style={styles.viewButton}>
          <Text style={styles.viewButtonText}>View details</Text>
          <SymbolIcon name="chevron.right" size={16} tintColor={colors.blue.primary} />
        </View>
      </View>
    </Pressable>
  );
}

type ReportItem = {
  readonly id: string;
  readonly subject: string;
  readonly status: string;
  readonly category?: string;
  readonly body?: string;
  readonly createdAt?: any;
};

function ReportCard({ report }: { readonly report: ReportItem }) {
  const isResolved = report.status === 'resolved' || report.status === 'closed';
  const isActionRequired = report.status === 'awaiting_response' || report.status === 'open';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, styles.reportBadge]}>
            <Text style={styles.reportBadgeText}>
              {report.category === 'lost_item' ? 'Lost Item' : 'Trip Report'}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.badge,
            isResolved
              ? styles.completedBadge
              : isActionRequired
                ? styles.awaitingBadge
                : styles.inProgressBadge,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              isResolved
                ? styles.completedBadgeText
                : isActionRequired
                  ? styles.awaitingBadgeText
                  : styles.inProgressBadgeText,
            ]}
          >
            {report.status.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.reportSubject}>{report.subject}</Text>
      {report.body ? (
        <Text style={styles.reportBody} numberOfLines={2}>
          {report.body}
        </Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Pressable
          style={styles.viewReportBtn}
          onPress={() => router.push('/(driver)/support')}
          accessibilityRole="button"
          accessibilityLabel={`View report ${report.subject}`}
        >
          <Text style={styles.viewReportBtnText}>View Report</Text>
          <SymbolIcon name="chevron.right" size={14} tintColor={colors.blue.primary} />
        </Pressable>
      </View>
    </View>
  );
}

export default function ActivityScreen() {
  const uid = auth.currentUser?.uid;
  const [tab, setTab] = useState<'trips' | 'reports'>('trips');
  const [reports, setReports] = useState<readonly ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(Boolean(uid));

  // Authoritative Trip History Hook
  const {
    data,
    isLoading: loadingTrips,
    isError: errorTrips,
    error: tripError,
    refetch: refetchTrips,
    isRefetching: isRefetchingTrips,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useDriverTripHistory(uid);

  const trips = useMemo(() => {
    return data?.pages.flatMap((page) => page.trips) ?? [];
  }, [data]);

  // Real-time Support Tickets / Reports Query
  useEffect(() => {
    if (!uid) {
      return;
    }
    const unsub = onSnapshot(
      query(collection(firestore, 'supportTickets'), where('createdBy', '==', uid)),
      (snapshot) => {
        const items = snapshot.docs.map((d: any) => {
          const docData = d.data();
          return {
            id: d.id,
            subject: String(docData.subject ?? 'Support report'),
            status: String(docData.status ?? 'open'),
            category: docData.category,
            body: docData.body,
            createdAt: docData.createdAt,
          };
        });
        setReports(items);
        setLoadingReports(false);
      },
      () => {
        setLoadingReports(false);
      },
    );
    return () => unsub();
  }, [uid]);

  return (
    <SafeAreaView style={styles.root}>
      {/* Page Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
        <Text style={styles.headerSubtitle}>Trips history and operational reports</Text>

        {/* Segmented Control */}
        <View style={styles.segmentedContainer}>
          <Pressable
            style={[styles.segmentBtn, tab === 'trips' && styles.segmentBtnActive]}
            onPress={() => setTab('trips')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'trips' }}
            accessibilityLabel="Trips tab"
          >
            <Text style={[styles.segmentText, tab === 'trips' && styles.segmentTextActive]}>
              Trips
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, tab === 'reports' && styles.segmentBtnActive]}
            onPress={() => setTab('reports')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'reports' }}
            accessibilityLabel="Reports tab"
          >
            <Text style={[styles.segmentText, tab === 'reports' && styles.segmentTextActive]}>
              Reports
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Trips Content */}
      {tab === 'trips' ? (
        loadingTrips ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.green.primary} />
            <Text style={styles.loadingText}>Loading trip history...</Text>
          </View>
        ) : errorTrips ? (
          <View style={styles.centerContainer}>
            <SymbolIcon name="exclamationmark.triangle.fill" size={36} tintColor={colors.danger} />
            <Text style={styles.errorTitle}>Unable to load trips</Text>
            <Text style={styles.errorText}>
              {getTripHistoryErrorMessage(tripError)}
            </Text>
            <Pressable style={styles.retryButton} onPress={() => refetchTrips()}>
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
            refreshControl={<RefreshControl refreshing={isRefetchingTrips} onRefresh={refetchTrips} />}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={colors.green.primary} />
                </View>
              ) : null
            }
          />
        )
      ) : (
        /* Reports Content */
        loadingReports ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.green.primary} />
            <Text style={styles.loadingText}>Loading reports...</Text>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.centerContainer}>
            <View style={styles.emptyIconCircle}>
              <SymbolIcon name="doc.text" size={32} tintColor={colors.ink[400]} />
            </View>
            <Text style={styles.emptyTitle}>No active reports</Text>
            <Text style={styles.emptySubtitle}>
              Lost-item reports and trip cases requiring your action will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={reports}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ReportCard report={item} />}
            contentContainerStyle={styles.listContent}
          />
        )
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
    marginBottom: spacing[3],
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface.muted,
    borderRadius: radius.pill,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    minHeight: 44,
  },
  segmentBtnActive: {
    backgroundColor: colors.surface.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 15,
    fontFamily: typography.family.medium,
    color: colors.ink[500],
  },
  segmentTextActive: {
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  listContent: {
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
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: typography.family.bold,
    letterSpacing: 0.5,
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
  reportBadge: {
    backgroundColor: colors.amber.tint,
  },
  reportBadgeText: {
    color: colors.amber.deep,
    fontSize: 11,
    fontFamily: typography.family.bold,
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
  awaitingBadge: {
    backgroundColor: colors.amber.tint,
  },
  awaitingBadgeText: {
    color: colors.amber.deep,
  },
  inProgressBadge: {
    backgroundColor: colors.blue.tint,
  },
  inProgressBadgeText: {
    color: colors.blue.primary,
  },
  timestampText: {
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
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
    fontSize: 15,
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
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
  },
  earningsValue: {
    fontSize: 18,
    fontFamily: typography.family.bold,
    color: colors.green.primary,
    marginTop: 2,
  },
  noEarningsValue: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.ink[400],
    marginTop: 2,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    minHeight: 44,
  },
  viewButtonText: {
    fontSize: 14,
    fontFamily: typography.family.semibold,
    color: colors.blue.primary,
  },
  reportSubject: {
    fontSize: 16,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    marginTop: spacing[2],
  },
  reportBody: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    marginTop: 4,
    lineHeight: 20,
  },
  viewReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
  },
  viewReportBtnText: {
    fontSize: 14,
    fontFamily: typography.family.semibold,
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
    fontSize: 18,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    textAlign: 'center',
    lineHeight: 20,
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
    paddingHorizontal: spacing[5],
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
  footerLoader: {
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
});
