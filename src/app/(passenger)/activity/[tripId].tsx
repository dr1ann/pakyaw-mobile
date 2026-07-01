import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Timestamp } from 'firebase/firestore';

import { Card } from '@/components/ui/Card';
import { RouteConnector } from '@/components/ui/RouteConnector';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useTripDetail } from '@/features/trip-history/hooks/useTripDetail';

export default function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const { data: trip, isLoading, error } = useTripDetail(tripId);

  if (isLoading) {
    return (
      <Screen background="passenger" style={styles.center}>
        <ActivityIndicator color={colors.blue.primary} size="large" />
      </Screen>
    );
  }

  if (error || !trip) {
    return (
      <Screen background="passenger" style={styles.center}>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Failed to load trip details.'}
        </Text>
        <Pressable style={styles.backBtn} onPress={() => router.replace('/activity')}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </Screen>
    );
  }

  const driverName = trip.driver?.displayName ?? 'Cancelled request';
  const plate = trip.driver?.plate ?? '—';
  const dateStr = formatDate(trip.requestedAt);

  return (
    <Screen background="passenger" style={styles.container} scroll padded>
      {/* Back Header */}
      <View style={styles.header}>
        <Pressable style={styles.backLink} onPress={() => router.replace('/activity')}>
          <Text style={styles.backLinkText}>← Back to Activity</Text>
        </Pressable>
        <Text style={styles.title}>Trip Details</Text>
      </View>

      {/* Main Info Card */}
      <Card style={styles.card}>
        <View style={styles.metaRow}>
          <Text style={styles.dateLabel}>{dateStr}</Text>
          <StatusPill
            label={trip.status === 'completed' ? 'Completed' : 'Cancelled'}
            tone={trip.status === 'completed' ? 'success' : 'danger'}
            dot
          />
        </View>

        {/* Route Details */}
        <View style={styles.routeRow}>
          <RouteConnector height={64} />
          <View style={styles.routeText}>
            <View>
              <Text style={styles.addressLabel}>PICKUP</Text>
              <Text style={styles.addressValue} numberOfLines={2}>
                {trip.pickup.label}
              </Text>
            </View>
            <View>
              <Text style={styles.addressLabel}>DESTINATION</Text>
              <Text style={styles.addressValue} numberOfLines={2}>
                {trip.destination.label}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Driver Details Card (only if driver exists) */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Driver & Vehicle</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Driver Name</Text>
          <Text style={styles.detailValue}>{driverName}</Text>
        </View>
        {trip.driver ? (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>License Plate</Text>
              <Text style={styles.detailValue}>{plate}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Driver Rating</Text>
              <Text style={styles.detailValue}>★ {trip.driver.rating.toFixed(1)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Completed Trips</Text>
              <Text style={styles.detailValue}>{trip.driver.tripCount}</Text>
            </View>
          </>
        ) : null}
      </Card>

      {/* Booking Details Card */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Booking Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Ride Mode</Text>
          <Text style={styles.detailValue}>PAKYAW (Solo)</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Passenger Count</Text>
          <Text style={styles.detailValue}>{trip.passengerCount}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Billed Seats</Text>
          <Text style={styles.detailValue}>{trip.billedSeats}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Trip ID</Text>
          <Text style={styles.detailValueId} numberOfLines={1} selectable={true}>
            {trip.id}
          </Text>
        </View>
      </Card>

      {/* Cancellation Details (if cancelled) */}
      {trip.status === 'cancelled' && (trip.cancelledBy || trip.cancelReason) ? (
        <Card style={[styles.card, styles.cancelledCard]}>
          <Text style={[styles.sectionTitle, styles.cancelledTitle]}>Cancellation Info</Text>
          {trip.cancelledBy ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cancelled By</Text>
              <Text style={styles.detailValue}>
                {trip.cancelledBy.charAt(0).toUpperCase() + trip.cancelledBy.slice(1)}
              </Text>
            </View>
          ) : null}
          {trip.cancelReason ? (
            <View style={styles.cancelReasonRow}>
              <Text style={styles.detailLabel}>Reason</Text>
              <Text style={styles.cancelReasonValue}>{trip.cancelReason}</Text>
            </View>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}

function formatDate(timestamp: Timestamp | string | number | Date | null | undefined): string {
  if (!timestamp) return '—';
  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (
    typeof timestamp === 'object' &&
    timestamp !== null &&
    'toDate' in timestamp &&
    typeof (timestamp as { toDate: unknown }).toDate === 'function'
  ) {
    date = (timestamp as { toDate: () => Date }).toDate();
  } else {
    date = new Date(timestamp as string | number);
  }

  return (
    date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' at ' +
    date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  header: {
    marginBottom: spacing[5],
    gap: spacing[2],
  },
  backLink: {
    alignSelf: 'flex-start',
    paddingVertical: spacing[1],
  },
  backLinkText: {
    fontSize: typography.size.bodySmall,
    color: colors.blue.primary,
    fontWeight: typography.weight.bold,
  },
  title: {
    fontSize: typography.size.h1,
    fontWeight: typography.weight.extraBold,
    color: colors.ink[900],
  },
  card: {
    marginBottom: spacing[4],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    gap: spacing[3],
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    paddingBottom: spacing[3],
  },
  dateLabel: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    fontWeight: typography.weight.medium,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing[4],
    marginTop: spacing[2],
  },
  routeText: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing[1],
  },
  addressLabel: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    color: colors.ink[500],
    letterSpacing: typography.letterSpacing.label,
    marginBottom: 2,
  },
  addressValue: {
    fontSize: typography.size.body,
    color: colors.ink[900],
    fontWeight: typography.weight.medium,
  },
  sectionTitle: {
    fontSize: typography.size.bodyMd,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    paddingBottom: spacing[2],
    marginBottom: spacing[1],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  detailLabel: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
  },
  detailValue: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
  },
  detailValueId: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    maxWidth: '60%',
  },
  cancelledCard: {
    borderColor: colors.danger,
    borderWidth: 1,
  },
  cancelledTitle: {
    color: colors.danger,
    borderBottomColor: colors.danger + '20',
  },
  cancelReasonRow: {
    gap: spacing[1],
    paddingVertical: spacing[1],
  },
  cancelReasonValue: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    fontStyle: 'italic',
    marginTop: spacing[1],
  },
  errorText: {
    fontSize: typography.size.body,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  backBtn: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radius.pill,
    backgroundColor: colors.blue.primary,
  },
  backBtnText: {
    color: colors.white,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.body,
  },
});
