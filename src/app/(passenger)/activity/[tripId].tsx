import React, { useState } from 'react';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@pakyaw/shared/components/ui/Card';
import { RouteConnector } from '@pakyaw/shared/components/ui/RouteConnector';
import { Screen } from '@pakyaw/shared/components/ui/Screen';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useTripDetail } from '@pakyaw/shared/features/trip-history/hooks/useTripDetail';
import { ReportIssueModal } from '@/features/support/components/ReportIssueModal';
import { getFareSurchargeTotal } from '@pakyaw/shared/transport/contract';

export default function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip, isLoading, error } = useTripDetail(tripId);
  const [reportModalVisible, setReportModalVisible] = useState(false);

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
        <Text style={styles.errorTitle}>Trip details unavailable</Text>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Failed to load trip details.'}
        </Text>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.replace('/activity')}
          accessibilityRole="button"
          accessibilityLabel="Go back to Activity"
          testID="trip-detail-back-btn"
        >
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </Screen>
    );
  }

  const isCompleted = trip.status === 'completed';
  const driverName = trip.driverPublic?.displayName ?? trip.driver?.displayName ?? (isCompleted ? 'Pakyaw Driver' : 'No driver assigned');
  const plate = trip.driverPublic?.vehicle?.plateNumber ?? trip.driver?.plate ?? null;
  const vehicleDesc = trip.driverPublic?.vehicle?.description ?? trip.driverPublic?.vehicle?.type ?? null;
  const unitBodyNumber = trip.driverPublic?.vehicle?.unitBodyNumber ?? null;

  const modeLabel = trip.mode === 'shared' ? 'Shared' : trip.mode === 'hop' ? 'Legacy Hop' : 'Pakyaw';

  const dateStr = formatDate(trip.completedAt ?? trip.requestedAt);

  const fareTotal = typeof trip.fare === 'number'
    ? trip.fare
    : typeof trip.fareBreakdown?.total === 'number'
      ? trip.fareBreakdown.total
      : null;
  const surchargeTotal = trip.fareBreakdown ? getFareSurchargeTotal(trip.fareBreakdown) : 0;

  const roadDistanceKm = trip.route && typeof trip.route.distanceMeters === 'number' && trip.route.distanceMeters > 0
    ? `${(trip.route.distanceMeters / 1000).toFixed(1)} km`
    : null;

  return (
    <Screen background="passenger" style={styles.container} scroll padded>
      {/* Back Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backLink}
          onPress={() => router.replace('/activity')}
          accessibilityRole="button"
          accessibilityLabel="Back to Activity"
          testID="back-to-activity-btn"
        >
          <SymbolIcon name="chevron.left" size={24} tintColor={colors.blue.primary} />
        </Pressable>
        <Text style={styles.title}>Trip Details</Text>
      </View>

      {/* Main Info Card */}
      <Card style={styles.card}>
        <View style={styles.metaRow}>
          <Text style={styles.dateLabel}>{dateStr}</Text>
          <StatusPill
            label={isCompleted ? 'Completed' : 'Cancelled'}
            tone={isCompleted ? 'success' : 'danger'}
            dot
          />
        </View>

        {/* Route Details */}
        <View style={styles.routeRow}>
          <RouteConnector height={64} />
          <View style={styles.routeText}>
            <View style={styles.addressBlock}>
              <Text style={styles.addressLabel}>PICKUP</Text>
              <Text style={styles.addressValue} numberOfLines={2}>
                {trip.pickup.label}
              </Text>
            </View>
            <View style={styles.addressBlock}>
              <Text style={styles.addressLabel}>DESTINATION</Text>
              <Text style={styles.addressValue} numberOfLines={2}>
                {trip.destination.label}
              </Text>
            </View>
          </View>
        </View>

        {roadDistanceKm ? (
          <View style={styles.distanceRow}>
            <Text style={styles.detailLabel}>Road Distance</Text>
            <Text style={styles.detailValue}>{roadDistanceKm}</Text>
          </View>
        ) : null}
      </Card>

      {/* Fare / Receipt Card (for completed trips) */}
      {isCompleted && fareTotal !== null ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Trip Fare</Text>
          <View style={styles.fareTotalRow}>
            <Text style={styles.fareTotalLabel}>Total</Text>
            <Text style={styles.fareTotalValue}>₱{fareTotal.toFixed(2)}</Text>
          </View>

          {trip.fareBreakdown ? (
            <View style={styles.breakdownContainer}>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Base Fare</Text>
                <Text style={styles.detailValue}>₱{(trip.fareBreakdown.baseFare ?? 0).toFixed(2)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Distance Fare</Text>
                <Text style={styles.detailValue}>₱{(trip.fareBreakdown.distanceFare ?? 0).toFixed(2)}</Text>
              </View>
              {surchargeTotal > 0 ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Surcharges</Text>
                  <Text style={styles.detailValue}>₱{surchargeTotal.toFixed(2)}</Text>
                </View>
              ) : null}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Service & Tech Fee</Text>
                <Text style={styles.detailValue}>₱{(trip.fareBreakdown.techFee ?? 0).toFixed(2)}</Text>
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* Driver & Vehicle Card */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Driver & Vehicle</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Driver</Text>
          <Text style={styles.detailValue}>{driverName}</Text>
        </View>
        {plate ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>License Plate</Text>
            <Text style={styles.detailValue}>{plate}</Text>
          </View>
        ) : null}
        {unitBodyNumber ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Body Number</Text>
            <Text style={styles.detailValue}>{unitBodyNumber}</Text>
          </View>
        ) : null}
        {vehicleDesc ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle</Text>
            <Text style={styles.detailValue}>{vehicleDesc}</Text>
          </View>
        ) : null}
      </Card>

      {/* Booking Details Card */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Booking Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Ride Mode</Text>
          <Text style={styles.detailValue}>{modeLabel}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Passengers</Text>
          <Text style={styles.detailValue}>
            {trip.passengerCount} {trip.passengerCount === 1 ? 'person' : 'people'}
          </Text>
        </View>
        {trip.bookingFor === 'other' ? (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Booking For</Text>
              <Text style={styles.detailValue}>Someone else</Text>
            </View>
            {trip.rider?.firstName ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Rider</Text>
                <Text style={styles.detailValue}>{trip.rider.firstName}</Text>
              </View>
            ) : null}
          </>
        ) : null}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Trip ID</Text>
          <Text style={styles.detailValueId} numberOfLines={1} selectable={true}>
            {trip.id}
          </Text>
        </View>
      </Card>

      {/* Report an Issue Action */}
      <Card style={[styles.card, styles.supportCard]}>
        <View style={styles.supportHeader}>
          <SymbolIcon name="questionmark.circle.fill" size={20} tintColor={colors.blue.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.supportTitle}>Need help with this trip?</Text>
            <Text style={styles.supportSubtitle}>
              Left an item behind, have a fare question, or ride concern?
            </Text>
          </View>
        </View>
        <Pressable
          style={styles.reportBtn}
          onPress={() => setReportModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Report an issue for this trip"
          testID="report-trip-issue-btn"
        >
          <SymbolIcon name="exclamationmark.bubble.fill" size={16} tintColor={colors.blue.primary} />
          <Text style={styles.reportBtnText}>Report an Issue</Text>
        </Pressable>
      </Card>

      <ReportIssueModal
        visible={reportModalVisible}
        tripId={trip.id}
        pickupLabel={trip.pickup.label}
        destinationLabel={trip.destination.label}
        onClose={() => setReportModalVisible(false)}
      />
    </Screen>
  );
}

function formatCancelReason(reason: string): string {
  if (reason === 'passenger_changed_mind') return 'Passenger changed mind';
  if (reason === 'driver_unavailable') return 'Driver unavailable';
  if (reason === 'unable_to_locate_passenger') return 'Unable to locate passenger';
  if (reason === 'vehicle_issue') return 'Vehicle issue';
  if (reason === 'safety_concern') return 'Safety concern';
  return reason;
}

function formatDate(timestamp: any): string {
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
  } else if (typeof timestamp === 'object' && timestamp !== null && typeof timestamp.seconds === 'number') {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp as string | number);
  }
  if (isNaN(date.getTime())) return '—';

  return (
    date.toLocaleDateString('en-US', {
      month: 'short',
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
    gap: spacing[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[5],
    gap: spacing[2],
  },
  backLink: {
    width: 48,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface.card,
    alignSelf: 'flex-start',
    paddingVertical: spacing[1],
    minHeight: 48,
    justifyContent: 'center',
  },
  backLinkText: {
    fontSize: typography.size.bodySmall,
    color: colors.blue.primary,
    fontWeight: typography.weight.bold,
  },
  title: {
    flex: 1,
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
    flexWrap: 'wrap',
    gap: spacing[2],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    paddingBottom: spacing[3],
  },
  dateLabel: {
    flexShrink: 1,
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
    gap: spacing[3],
    paddingVertical: spacing[1],
  },
  addressBlock: {
    gap: 2,
  },
  addressLabel: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    color: colors.ink[400],
    letterSpacing: typography.letterSpacing.label,
  },
  addressValue: {
    fontSize: typography.size.body,
    color: colors.ink[900],
    fontWeight: typography.weight.medium,
  },
  distanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing[3],
    marginTop: spacing[1],
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
  fareTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  fareTotalLabel: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    color: colors.ink[700],
  },
  fareTotalValue: {
    fontSize: typography.size.h2,
    fontWeight: typography.weight.extraBold,
    color: colors.ink[900],
  },
  breakdownContainer: {
    gap: spacing[2],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing[1],
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
  errorTitle: {
    fontSize: typography.size.bodyMd,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  errorText: {
    fontSize: typography.size.bodySmall,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  backBtn: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radius.pill,
    backgroundColor: colors.blue.primary,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    color: colors.white,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.body,
  },
  supportCard: {
    borderColor: colors.blue.primary + '30',
    backgroundColor: colors.surface.card,
    gap: spacing[3],
    marginTop: spacing[2],
    marginBottom: spacing[6],
  },
  supportHeader: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  supportTitle: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  supportSubtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    marginTop: 2,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.blue.tint,
    borderColor: colors.blue.primary + '40',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    minHeight: 48,
  },
  reportBtnText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
  },
});
