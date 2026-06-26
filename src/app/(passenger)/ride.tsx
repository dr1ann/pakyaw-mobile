/**
 * Ride screen — (passenger)/ride.tsx
 *
 * Phase 12D: Map-Driven Booking & Figma Alignment.
 *
 * The screen manages the passenger booking flow and active trip states.
 * Under Phase 12, the passenger booking flow is fully map-driven:
 *   - No active trip:
 *     - Default: HomeSheet ("Where to, James?", nearby stats)
 *     - Search: SetDestinationSheet (Autocomplete for pickup or destination)
 *     - Destination set: BookingSheet (Pakyaw Solo options, placeholder details)
 *   - Active trip:
 *     - Status-driven active sheets (Searching, Matched, En Route, Arrived, etc.)
 */

import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert, LayoutAnimation, Modal, Platform, StyleSheet, UIManager, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors, shadow } from '@/constants/theme';
import { useSession } from '@/features/auth/hooks/useSession';
import { getUserDoc } from '@/features/auth/services/auth.service';
import type { UserDoc } from '@/features/auth/types';
import { BookingSheet } from '@/features/booking/components/BookingSheet';
import { HomeSheet } from '@/features/booking/components/HomeSheet';
import { SearchingSheet } from '@/features/booking/components/SearchingSheet';
import { SetDestinationSheet } from '@/features/booking/components/SetDestinationSheet';
import { useRouteQuery } from '@/features/maps/hooks/useRouteQuery';
import { reverseGeocode } from '@/features/maps/services/placesService';
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
import { logger } from '@/lib/logger';
import { isInServiceArea } from '@/lib/serviceArea';
import { useActiveTripStore } from '@/stores/activeTripStore';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function RideScreen() {
  const trip = useActiveTripStore((s) => s.trip);
  const tripId = useActiveTripStore((s) => s.tripId);
  const driverLocation = useActiveTripStore((s) => s.driverLocation);
  const draft = useBookingDraftStore((s) => s.draft);
  const setPickup = useBookingDraftStore((s) => s.setPickup);
  const setDestination = useBookingDraftStore((s) => s.setDestination);
  const setRoute = useBookingDraftStore((s) => s.setRoute);

  const { uid } = useSession();
  const [searchMode, setSearchMode] = useState<'pickup' | 'destination' | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [pickupDragKey, setPickupDragKey] = useState(0);
  const [destinationDragKey, setDestinationDragKey] = useState(0);

  // Subscribe to trip doc + driver location
  useActiveTrip();
  useDriverLocation();

  // Query route polyline and info when pickup and destination are available
  const { data: routeData } = useRouteQuery({
    pickup: draft.pickup,
    destination: draft.destination,
  });

  // Sync query route data to bookingDraftStore
  useEffect(() => {
    setRoute(routeData ?? null);
  }, [routeData, setRoute]);

  // Query user profile to display passenger's first name
  const { data: profile } = useQuery<UserDoc | null>({
    queryKey: ['profile', uid],
    queryFn: () => getUserDoc(uid!),
    enabled: !!uid,
    staleTime: 5 * 60_000,
  });

  // Auto-resolve current location on mount if pickup is empty
  useEffect(() => {
    if (draft.pickup) return;

    let active = true;
    async function resolveInitialLocation() {
      try {
        logger.info('[RideScreen] Requesting location permission on mount...');
        const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
        if (permStatus !== 'granted') {
          logger.warn('[RideScreen] Location permission not granted');
          return;
        }

        logger.info('[RideScreen] Fetching current position...');
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!active) return;

        logger.info('[RideScreen] Reverse-geocoding current position...', loc.coords);
        const place = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
        if (place && active) {
          logger.info('[RideScreen] Initialized pickup location:', place);
          setPickup(place);
        }
      } catch (err) {
        logger.error('[RideScreen] Failed to resolve initial location', err);
      }
    }

    void resolveInitialLocation();

    return () => {
      active = false;
    };
  }, [draft.pickup, setPickup]);

  // Draggable pickup pin callback with strict service-area validation and immediate route recalculation
  const handlePickupDragEnd = (coords: { latitude: number; longitude: number }) => {
    if (!isInServiceArea(coords)) {
      logger.warn('[RideScreen] Dragged pickup pin outside service area, blocking update', coords);
      Alert.alert(
        'Service Area',
        'Service is currently available only within Ormoc City.'
      );
      // Revert marker to last valid position by changing key
      setPickupDragKey((k) => k + 1);
      return;
    }

    logger.info('[RideScreen] Pickup pin drag ended inside Ormoc, updating store immediately', coords);
    
    // Invalidate route and update coordinates immediately
    setPickup({
      coords: { lat: coords.latitude, lng: coords.longitude },
      label: draft.pickup?.label || 'Pin Drop Location',
    });

    // Run geocoder in parallel to resolve actual name
    void (async () => {
      try {
        const place = await reverseGeocode(coords.latitude, coords.longitude);
        if (place) {
          setPickup(place);
        }
      } catch (err) {
        logger.error('[RideScreen] Failed to reverse-geocode dragged pickup coords', err);
      }
    })();
  };

  // Draggable destination pin callback with strict service-area validation and immediate route recalculation
  const handleDestinationDragEnd = (coords: { latitude: number; longitude: number }) => {
    if (!isInServiceArea(coords)) {
      logger.warn('[RideScreen] Dragged destination pin outside service area, blocking update', coords);
      Alert.alert(
        'Service Area',
        'Service is currently available only within Ormoc City.'
      );
      // Revert marker to last valid position by changing key
      setDestinationDragKey((k) => k + 1);
      return;
    }

    logger.info('[RideScreen] Destination pin drag ended inside Ormoc, updating store immediately', coords);

    // Invalidate route and update coordinates immediately
    setDestination({
      coords: { lat: coords.latitude, lng: coords.longitude },
      label: draft.destination?.label || 'Pin Drop Location',
    });

    // Run geocoder in parallel to resolve actual name
    void (async () => {
      try {
        const place = await reverseGeocode(coords.latitude, coords.longitude);
        if (place) {
          setDestination(place);
        }
      } catch (err) {
        logger.error('[RideScreen] Failed to reverse-geocode dragged destination coords', err);
      }
    })();
  };

  const handleToggleMinimize = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsMinimized((prev) => !prev);
  };

  function handleDismissTerminal() {
    useActiveTripStore.getState().clearTrip();
  }

  const status = trip?.status ?? (tripId ? 'request' : null);
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
        onPickupDragEnd={status === null ? handlePickupDragEnd : undefined}
        onDestinationDragEnd={status === null ? handleDestinationDragEnd : undefined}
        pickupKey={pickupDragKey}
        destinationKey={destinationDragKey}
        routePolyline={trip?.route?.polyline ?? draft.route?.polyline ?? null}
        bottomPadding={isMinimized ? 160 : 320}
      />

      {/* Bottom Sheet Overlays */}
      {status === null ? (
        // Booking Flow sheets
        searchMode ? (
          // Full-screen search overlay.
          // Rendered inside a Modal so it paints in its own native window above
          // the Google map surface. On Android the native MapView (PROVIDER_GOOGLE)
          // renders on top of sibling RN views, which would otherwise hide a plain
          // absolute-positioned overlay (only the autofocused keyboard would show).
          <Modal
            visible
            animationType="slide"
            statusBarTranslucent
            onRequestClose={() => setSearchMode(null)}
          >
            <SafeAreaProvider>
              <SafeAreaView style={styles.fullscreenSearch}>
                <SetDestinationSheet
                  mode={searchMode}
                  onClose={() => setSearchMode(null)}
                  onSelect={(place) => {
                    if (searchMode === 'pickup') {
                      setPickup(place);
                    } else {
                      setDestination(place);
                      setIsMinimized(false);
                    }
                    setSearchMode(null);
                  }}
                />
              </SafeAreaView>
            </SafeAreaProvider>
          </Modal>
        ) : draft.destination ? (
          // Figma-aligned Booking options sheet
          <SafeAreaView edges={['bottom']} style={styles.bookingSheetArea} pointerEvents="box-none">
            <View style={[
              styles.bookingSheetCard,
              isMinimized && styles.bookingSheetCardMinimized,
              shadow.float
            ]}>
              <BookingSheet
                onSearchPickup={() => setSearchMode('pickup')}
                onSearchDestination={() => setSearchMode('destination')}
                isMinimized={isMinimized}
                onToggleMinimize={handleToggleMinimize}
              />
            </View>
          </SafeAreaView>
        ) : (
          // Figma-aligned Home sheet ("Where to?")
          <SafeAreaView edges={['bottom']} style={styles.sheetArea} pointerEvents="box-none">
            <HomeSheet
              onSearchPress={() => setSearchMode('destination')}
              passengerName={profile?.firstName}
            />
          </SafeAreaView>
        )
      ) : (
        // Active Trip Sheets (Status-driven)
        isSheetSelfContained ? (
          <TripSheet status={status} onDismiss={handleDismissTerminal} />
        ) : (
          <SafeAreaView edges={['bottom']} style={styles.sheetArea} pointerEvents="box-none">
            <View style={[styles.sheetCard, shadow.float]}>
              <TripSheet status={status} onDismiss={handleDismissTerminal} />
            </View>
          </SafeAreaView>
        )
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
  bookingSheetArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bookingSheetCard: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
    overflow: 'hidden',
  },
  bookingSheetCardMinimized: {
    height: 180,
  },
  fullscreenSearch: {
    flex: 1,
    backgroundColor: colors.surface.card,
  },
});
