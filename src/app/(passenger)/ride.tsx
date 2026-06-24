/**
 * Ride screen — (passenger)/ride.tsx
 *
 * Phase 8E: status-driven bottom sheet switching.
 *
 * The trip document status drives which sheet is visible:
 *   null / no trip  → BookingSheet (create a trip)
 *   request         → SearchingSheet (waiting for driver match)
 *   accepted        → DriverMatchedSheet
 *   driver_arriving → EnRouteSheet
 *   driver_arrived  → ArrivedSheet
 *   in_progress     → InTripSheet
 *   completed       → CompletedSheet
 *   cancelled       → CancelledSheet
 */

import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, shadow } from '@/constants/theme';
import { BookingSheet } from '@/features/booking/components/BookingSheet';
import { SearchingSheet } from '@/features/booking/components/SearchingSheet';
import { ArrivedSheet } from '@/features/trip/components/ArrivedSheet';
import { CancelledSheet } from '@/features/trip/components/CancelledSheet';
import { CompletedSheet } from '@/features/trip/components/CompletedSheet';
import { DriverMatchedSheet } from '@/features/trip/components/DriverMatchedSheet';
import { EnRouteSheet } from '@/features/trip/components/EnRouteSheet';
import { InTripSheet } from '@/features/trip/components/InTripSheet';
import { LiveMap } from '@/features/trip/components/LiveMap';
import { useActiveTrip } from '@/features/trip/hooks/useActiveTrip';
import { useDriverLocation } from '@/features/trip/hooks/useDriverLocation';
import type { TripStatus } from '@/features/trip/types';
import { useActiveTripStore } from '@/stores/activeTripStore';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';

export default function RideScreen() {
  const trip = useActiveTripStore((s) => s.trip);
  const driverLocation = useActiveTripStore((s) => s.driverLocation);
  const draft = useBookingDraftStore((s) => s.draft);

  // Subscribe to trip doc + driver location.
  useActiveTrip();
  useDriverLocation();

  function handleDismissTerminal() {
    useActiveTripStore.getState().clearTrip();
  }

  const status = trip?.status ?? null;
  const isSheetSelfContained = status === null || status === 'request';

  // Extract coordinates for LiveMap, checking both active trip and booking draft
  const pickupLocation = trip?.pickup?.coords
    ? { latitude: trip.pickup.coords.lat, longitude: trip.pickup.coords.lng }
    : draft.pickup?.coords
    ? { latitude: draft.pickup.coords.lat, longitude: draft.pickup.coords.lng }
    : null;

  const destinationLocation = trip?.destination?.coords
    ? { latitude: trip.destination.coords.lat, longitude: trip.destination.coords.lng }
    : draft.destination?.coords
    ? { latitude: draft.destination.coords.lat, longitude: draft.destination.coords.lng }
    : null;

  return (
    <View style={styles.root}>
      {/* Interactive Map Background */}
      <LiveMap
        driverLocation={driverLocation}
        pickupLocation={pickupLocation}
        destinationLocation={destinationLocation}
        showDestination={true}
      />

      {/* Status-driven Bottom Sheet Overlay */}
      {isSheetSelfContained ? (
        <TripSheet status={status} onDismiss={handleDismissTerminal} />
      ) : (
        <SafeAreaView edges={['bottom']} style={styles.sheetArea} pointerEvents="box-none">
          <View style={[styles.sheetCard, shadow.float]}>
            <TripSheet status={status} onDismiss={handleDismissTerminal} />
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

type TripSheetProps = {
  status: TripStatus | null;
  onDismiss: () => void;
};

function TripSheet({ status, onDismiss }: TripSheetProps) {
  switch (status) {
    case 'request':
      return <SearchingSheet />;
    case 'accepted':
      return <DriverMatchedSheet />;
    case 'driver_arriving':
      return <EnRouteSheet />;
    case 'driver_arrived':
      return <ArrivedSheet />;
    case 'in_progress':
      return <InTripSheet />;
    case 'completed':
      return <CompletedSheet onDismiss={onDismiss} />;
    case 'cancelled':
      return <CancelledSheet onDismiss={onDismiss} />;
    default:
      return <BookingSheet />;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.bgPassenger,
  },
  sheetArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetCard: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
