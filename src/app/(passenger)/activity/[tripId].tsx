import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@pakyaw/shared/components/ui/Card';
import { RouteConnector } from '@pakyaw/shared/components/ui/RouteConnector';
import { Screen } from '@pakyaw/shared/components/ui/Screen';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useTripDetail } from '@pakyaw/shared/features/trip-history/hooks/useTripDetail';
import {
  formatPeso,
  formatRoadDistance,
  formatTripDateTime,
  passengerCancellationCopy,
  passengerRideModeLabel,
} from '@/features/trip-history/presentation';

export default function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip, isLoading, error, refetch, isFetching } = useTripDetail(tripId);

  if (isLoading) {
    return (
      <Screen background="passenger" style={styles.center}>
        <ActivityIndicator color={colors.blue.primary} size="large" accessibilityLabel="Loading trip details" />
      </Screen>
    );
  }

  if (error || !trip) {
    return (
      <Screen background="passenger" style={styles.center}>
        <SymbolIcon name="arrow.clockwise" size={30} tintColor={colors.ink[400]} />
        <Text style={styles.errorTitle}>Couldn’t load this ride</Text>
        <Text style={styles.errorCopy}>Check your connection and try again.</Text>
        <Pressable onPress={() => refetch()} disabled={isFetching} style={styles.retryButton} accessibilityRole="button">
          <Text style={styles.retryLabel}>{isFetching ? 'Trying again…' : 'Try again'}</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/activity')} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backButtonLabel}>Back to Activity</Text>
        </Pressable>
      </Screen>
    );
  }

  const completed = trip.status === 'completed';
  const happenedAt = completed ? trip.completedAt ?? trip.requestedAt : trip.cancelledAt ?? trip.requestedAt;
  const dateTime = formatTripDateTime(happenedAt, true) ?? 'Date unavailable';
  const timestampLabel = completed
    ? trip.completedAt ? 'Completed' : 'Requested'
    : trip.cancelledAt ? 'Cancelled' : 'Requested';
  const fare = completed ? formatPeso(trip.fare) : null;
  const distance = completed ? formatRoadDistance(trip.route?.distanceMeters) : null;
  const driverName = trip.driverPublic?.displayName ?? trip.driver?.displayName ?? null;
  const vehicle = trip.driverPublic?.vehicle;
  const cancellationCopy = passengerCancellationCopy(trip.cancelReason);

  return (
    <Screen background="passenger" style={styles.container} scroll padded>
      <View style={styles.header}>
        <Pressable style={styles.backLink} onPress={() => router.replace('/activity')} accessibilityRole="button">
          <Text style={styles.backLinkText}>← Activity</Text>
        </Pressable>
        <Text style={styles.title}>{completed ? 'Trip summary' : 'Ride details'}</Text>
        <Text style={styles.date}>{`${timestampLabel} ${dateTime}`}</Text>
      </View>

      <Card style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.mode}>{passengerRideModeLabel(trip.mode)}</Text>
            <Text style={styles.modeCaption}>{completed ? 'Ride completed' : 'Ride cancelled'}</Text>
          </View>
          <StatusPill label={completed ? 'Completed' : 'Cancelled'} tone={completed ? 'success' : 'neutral'} dot />
        </View>
        {fare ? (
          <View style={styles.fareRow} accessibilityLabel={`Trip fare ${fare}`}>
            <Text style={styles.fareLabel}>Trip fare</Text>
            <Text style={styles.fare}>{fare}</Text>
          </View>
        ) : null}
        {distance ? <Text style={styles.distance}>{distance} by road route</Text> : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Your route</Text>
        <View style={styles.routeRow}>
          <RouteConnector height={72} />
          <View style={styles.routeText}>
            <View>
              <Text style={styles.routeLabel}>PICKUP</Text>
              <Text style={styles.routeValue}>{trip.pickup.label}</Text>
            </View>
            <View>
              <Text style={styles.routeLabel}>DESTINATION</Text>
              <Text style={styles.routeValue}>{trip.destination.label}</Text>
            </View>
          </View>
        </View>
      </Card>

      {driverName ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Driver & vehicle</Text>
          <View style={styles.driverRow}>
            {trip.driverPublic?.profilePhotoUrl ? (
              <Image source={{ uri: trip.driverPublic.profilePhotoUrl }} style={styles.avatar} accessibilityLabel={`${driverName} profile photo`} />
            ) : (
              <View style={styles.avatarFallback} accessibilityLabel="Driver photo unavailable">
                <SymbolIcon name="person.fill" size={18} tintColor={colors.blue.primary} />
              </View>
            )}
            <View style={styles.driverCopy}>
              <Text style={styles.driverName}>{driverName}</Text>
              {vehicle?.type ? <Text style={styles.vehicle}>{vehicle.type}</Text> : null}
              {vehicle?.plateNumber || trip.driver?.plate ? (
                <Text style={styles.plate}>Plate {vehicle?.plateNumber ?? trip.driver?.plate}</Text>
              ) : null}
            </View>
          </View>
        </Card>
      ) : null}

      {trip.bookingFor === 'other' ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Ride for: Someone else</Text>
          {trip.rider?.firstName ? <Text style={styles.riderCopy}>Rider: {trip.rider.firstName}</Text> : null}
        </Card>
      ) : null}

      {!completed && cancellationCopy ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Cancellation</Text>
          <Text style={styles.riderCopy}>{cancellationCopy}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[3] },
  header: { marginBottom: spacing[5], gap: spacing[1] },
  backLink: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center' },
  backLinkText: { color: colors.blue.primary, fontSize: typography.size.bodySmall, fontFamily: typography.family.bold },
  title: { color: colors.ink[900], fontSize: typography.size.h1, fontFamily: typography.family.extraBold },
  date: { color: colors.ink[500], fontSize: typography.size.bodySmall, fontFamily: typography.family.medium },
  summaryCard: { marginBottom: spacing[4], gap: spacing[3], backgroundColor: colors.blue.tint },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[3] },
  mode: { color: colors.ink[900], fontSize: typography.size.h3, fontFamily: typography.family.bold },
  modeCaption: { color: colors.ink[500], fontSize: typography.size.bodySmall, fontFamily: typography.family.medium },
  fareRow: { borderTopWidth: 1, borderTopColor: colors.blue.primary + '20', paddingTop: spacing[3], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  fareLabel: { color: colors.ink[700], fontSize: typography.size.body, fontFamily: typography.family.semibold },
  fare: { color: colors.blue.primary, fontSize: typography.size.h2, fontFamily: typography.family.extraBold },
  distance: { color: colors.ink[500], fontSize: typography.size.caption, fontFamily: typography.family.medium },
  card: { marginBottom: spacing[4], gap: spacing[3] },
  sectionTitle: { color: colors.ink[900], fontSize: typography.size.bodyMd, fontFamily: typography.family.bold },
  routeRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing[3] },
  routeText: { flex: 1, justifyContent: 'space-between', gap: spacing[4] },
  routeLabel: { color: colors.ink[400], fontSize: typography.size.label, fontFamily: typography.family.bold, letterSpacing: typography.letterSpacing.label },
  routeValue: { color: colors.ink[900], fontSize: typography.size.body, fontFamily: typography.family.semibold, marginTop: 2 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatar: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.surface.muted },
  avatarFallback: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.blue.tint, alignItems: 'center', justifyContent: 'center' },
  driverCopy: { flex: 1, gap: 1 },
  driverName: { color: colors.ink[900], fontSize: typography.size.body, fontFamily: typography.family.bold },
  vehicle: { color: colors.ink[500], fontSize: typography.size.bodySmall, fontFamily: typography.family.medium },
  plate: { color: colors.ink[500], fontSize: typography.size.bodySmall, fontFamily: typography.family.medium },
  riderCopy: { color: colors.ink[700], fontSize: typography.size.body, fontFamily: typography.family.medium },
  errorTitle: { color: colors.ink[900], fontSize: typography.size.h3, fontFamily: typography.family.bold },
  errorCopy: { color: colors.ink[500], fontSize: typography.size.body, textAlign: 'center' },
  retryButton: { minHeight: 48, paddingHorizontal: spacing[5], justifyContent: 'center', backgroundColor: colors.blue.primary, borderRadius: radius.pill },
  retryLabel: { color: colors.white, fontSize: typography.size.button, fontFamily: typography.family.bold },
  backButton: { minHeight: 48, paddingHorizontal: spacing[4], justifyContent: 'center' },
  backButtonLabel: { color: colors.blue.primary, fontSize: typography.size.body, fontFamily: typography.family.bold },
});
