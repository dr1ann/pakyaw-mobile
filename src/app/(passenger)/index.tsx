/**
 * Passenger ride screen — (passenger)/index.tsx
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

import { useRideCameraController } from '@pakyaw/shared/features/maps/hooks/useRideCameraController';
import { useInterpolatedCoordinate } from '@pakyaw/shared/features/maps/hooks/useInterpolatedCoordinate';
import { useLocationStore } from '@/stores/locationStore';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, LayoutAnimation, Modal, Platform, StyleSheet, UIManager, View } from 'react-native';
import MapView from 'react-native-maps';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { LocationLoader } from '@pakyaw/shared/components/ui/LocationLoader';
import { colors, shadow } from '@/constants/theme';
import { useSession } from '@pakyaw/shared/features/auth/hooks/useSession';
import { getUserDoc } from '@pakyaw/shared/features/auth/services/auth.service';
import type { UserDoc } from '@pakyaw/shared/features/auth/types';
import { BookingSheet } from '@/features/booking/components/BookingSheet';
import { HomeSheet } from '@/features/booking/components/HomeSheet';
import { SearchingSheet } from '@/features/booking/components/SearchingSheet';
import { SetDestinationSheet } from '@/features/booking/components/SetDestinationSheet';
import { useRouteQuery } from '@/features/maps/hooks/useRouteQuery';
import { reverseGeocode } from '@pakyaw/shared/features/maps/services/placesService';
import { ArrivedSheet } from '@/features/trip/components/ArrivedSheet';
import { CancelledSheet } from '@pakyaw/shared/features/trip/components/CancelledSheet';
import { CompletedSheet } from '@pakyaw/shared/features/trip/components/CompletedSheet';
import { DriverMatchedSheet } from '@/features/trip/components/DriverMatchedSheet';
import { EnRouteSheet } from '@/features/trip/components/EnRouteSheet';
import { InTripSheet } from '@/features/trip/components/InTripSheet';
import { LiveMap } from '@pakyaw/shared/features/trip/components/LiveMap';
import { useActiveTrip } from '@pakyaw/shared/features/trip/hooks/useActiveTrip';
import { useDriverLocation } from '@/features/trip/hooks/useDriverLocation';
import type { TripStatus } from '@pakyaw/shared/features/trip/types';
import { haversineMeters } from '@pakyaw/shared/lib/geo';
import { getDistanceToStepEnd } from '@pakyaw/shared/lib/geoProjection';
import { logger } from '@pakyaw/shared/lib/logger';
import { decodePolyline } from '@pakyaw/shared/lib/maps/decodePolyline';
import { isInServiceArea } from '@/lib/serviceArea';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { routeMatchesInputs, useBookingDraftStore } from '@/stores/bookingDraftStore';

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

  const deviceLocation = useLocationStore((s) => s.location);
  const permissionStatus = useLocationStore((s) => s.permissionStatus);

  const mapRef = useRef<MapView>(null);

  // Derive phase: Booking / Connecting / Active / Terminal
  const phase = useMemo<'booking' | 'connecting' | 'active' | 'terminal'>(() => {
    if (!tripId) {
      return 'booking';
    }
    if (!trip) {
      return 'connecting';
    }
    if (['completed', 'cancelled'].includes(trip.status)) {
      return 'terminal';
    }
    return 'active';
  }, [tripId, trip]);

  const isLocationLoading = phase === 'booking' && !deviceLocation && permissionStatus !== 'denied';

  // Subscribe to trip doc + driver location
  useActiveTrip();
  useDriverLocation();

  // Smooth the passenger-facing driver marker between GPS updates so it does
  // not teleport across the map as new Firestore snapshots arrive.
  const interpolatedDriverLocation = useInterpolatedCoordinate(driverLocation);

  // Distance from the driver's current position to the trip pickup — used by
  // the in-trip pickup marker fade-out (Grab / Uber parity).
  const driverDistanceFromPickup = useMemo(() => {
    if (!driverLocation || !trip?.pickup?.coords) return null;
    return haversineMeters(
      { lat: driverLocation.latitude, lng: driverLocation.longitude },
      trip.pickup.coords
    );
  }, [driverLocation, trip?.pickup?.coords]);

  // Render Selector: resolves which facts feed the map based on the phase
  const mapData = useMemo(() => {
    if (phase === 'booking' || phase === 'connecting') {
      // §13.2: only render the accepted route when it was computed for the
      // current pickup/destination. A retained route from a previous origin is
      // stale and must not be drawn as if current (no straight-line either).
      const routeIsCurrent = routeMatchesInputs({
        pickup: draft.pickup,
        destination: draft.destination,
        route: draft.route,
      });
      return {
        pickupLocation: draft.pickup?.coords
          ? { latitude: draft.pickup.coords.lat, longitude: draft.pickup.coords.lng }
          : null,
        destinationLocation: draft.destination?.coords
          ? { latitude: draft.destination.coords.lat, longitude: draft.destination.coords.lng }
          : null,
        routePolyline: routeIsCurrent ? (draft.route?.polyline ?? null) : null,
        driverLocation: null,
        showDriverRoute: false,
        driverRoutePolyline: null,
        driverRouteVariant: 'pickup' as const,
        driverRouteProgressCoordinate: null,
      };
    }

    if (phase === 'terminal') {
      return {
        pickupLocation: null,
        destinationLocation: null,
        routePolyline: null,
        driverLocation: null,
        showDriverRoute: false,
        driverRoutePolyline: null,
        driverRouteVariant: 'pickup' as const,
        driverRouteProgressCoordinate: null,
      };
    }

    // Active phase — visualization is driven entirely by trip.status and the
    // live driver location so restoration reconstructs the exact same picture.
    const tripStatus = trip?.status;
    const isPrePickup =
      tripStatus === 'accepted' || tripStatus === 'driver_arriving';
    const isArrived = tripStatus === 'driver_arrived';
    const isInTrip = tripStatus === 'in_progress';

    const pickupCoord = trip?.pickup?.coords
      ? { latitude: trip.pickup.coords.lat, longitude: trip.pickup.coords.lng }
      : null;
    const destinationCoord = trip?.destination?.coords
      ? { latitude: trip.destination.coords.lat, longitude: trip.destination.coords.lng }
      : null;
    const driverCoord = interpolatedDriverLocation
      ? {
          latitude: interpolatedDriverLocation.latitude,
          longitude: interpolatedDriverLocation.longitude,
        }
      : null;

    // Pickup marker visibility:
    //   - Pre-pickup & arrived: always visible.
    //   - In-trip: keep visible briefly after start, then remove once the
    //     driver has clearly departed the pickup (Grab / Uber behavior). Using
    //     driver-position (not a wall-clock timer) means restoration lands on
    //     the right state without persisting extra local state.
    const PICKUP_FADE_DISTANCE_M = 150;
    const shouldShowPickup =
      isPrePickup ||
      isArrived ||
      (isInTrip &&
        (driverDistanceFromPickup == null ||
          driverDistanceFromPickup < PICKUP_FADE_DISTANCE_M));

    // Route polyline selection:
    //   - Pre-pickup: driver → pickup (live navigation route from driver).
    //   - Arrived: no polyline — driver is at pickup.
    //   - In-trip: driver → destination (live navigation route). Falls back
    //     to the static booking route (trip.route.polyline) only until the
    //     first live update arrives, so the passenger always sees a route.
    const liveDriverRoute = trip?.driverRoute?.polyline ?? null;
    let showDriverRoute = false;
    let driverRoutePolyline: string | null = null;
    let routePolyline: string | null = null;
    let driverRouteVariant: 'pickup' | 'trip' = 'pickup';

    if (isPrePickup) {
      showDriverRoute = liveDriverRoute != null;
      driverRoutePolyline = liveDriverRoute;
      driverRouteVariant = 'pickup';
      // Do not draw the static pickup→destination booking route yet — the
      // driver-facing pre-pickup leg is what the passenger cares about.
      routePolyline = null;
    } else if (isArrived) {
      // Driver has reached pickup — no polyline is drawn.
      showDriverRoute = false;
      driverRoutePolyline = null;
      routePolyline = null;
    } else if (isInTrip) {
      driverRouteVariant = 'trip';
      if (liveDriverRoute != null) {
        showDriverRoute = true;
        driverRoutePolyline = liveDriverRoute;
        routePolyline = null;
      } else {
        // Live driver-navigation route hasn't landed yet after the transition
        // to in_progress. Show the static booking route briefly so the map
        // isn't blank; the trimming logic below still shrinks it toward the
        // destination as the driver moves.
        showDriverRoute = false;
        driverRoutePolyline = null;
        routePolyline = trip?.route?.polyline ?? null;
      }
    }

    return {
      pickupLocation: shouldShowPickup ? pickupCoord : null,
      destinationLocation: destinationCoord,
      routePolyline,
      driverLocation: driverCoord,
      showDriverRoute,
      driverRoutePolyline,
      driverRouteVariant,
      driverRouteProgressCoordinate: driverCoord,
    };
  }, [
    phase,
    draft.pickup,
    draft.destination,
    draft.route,
    trip,
    interpolatedDriverLocation,
    driverDistanceFromPickup,
  ]);

  const cameraController = useRideCameraController(mapRef, {
    pickupLocation: mapData.pickupLocation,
    destinationLocation: mapData.destinationLocation,
    driverLocation: mapData.driverLocation,
    ownLocation: deviceLocation,
    phase,
    bottomPadding: isMinimized ? 160 : 320,
  });

  // Query route polyline and info when pickup and destination are available
  const { data: routeData, isLoading, isFetching } = useRouteQuery({
    pickup: draft.pickup,
    destination: draft.destination,
  });

  // Sync query route data to bookingDraftStore (only when it resolves).
  // Tag the accepted route with the pickup/destination it was computed for so
  // the render selector can detect a stale (wrong-origin) route (§13.2).
  useEffect(() => {
    if (routeData && draft.pickup?.coords && draft.destination?.coords) {
      setRoute({
        ...routeData,
        source: {
          pickup: draft.pickup.coords,
          destination: draft.destination.coords,
        },
      });
    }
  }, [routeData, draft.pickup, draft.destination, setRoute]);

  // Query user profile to display passenger's first name
  const { data: profile } = useQuery<UserDoc | null>({
    queryKey: ['profile', uid],
    queryFn: () => getUserDoc(uid!),
    enabled: !!uid,
    staleTime: 5 * 60_000,
  });

  // Auto-resolve / seed pickup from device location when available and pickup is empty
  useEffect(() => {
    if (draft.pickup || !deviceLocation) return;
    const { latitude, longitude } = deviceLocation;

    let active = true;
    async function seedPickup() {
      try {
        logger.info('[RideScreen] Seeding pickup from device location...', deviceLocation);
        const place = await reverseGeocode(latitude, longitude);
        if (place && active) {
          logger.info('[RideScreen] Seeded pickup location:', place);
          setPickup(place);
        }
      } catch (err) {
        logger.error('[RideScreen] Failed to seed pickup location', err);
      }
    }

    void seedPickup();

    return () => {
      active = false;
    };
  }, [deviceLocation, draft.pickup, setPickup]);

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
    useBookingDraftStore.getState().reset();
    useActiveTripStore.getState().clearTrip();
  }

  const status = trip?.status ?? (tripId ? 'request' : null);
  const isSheetSelfContained = status === null || status === 'request';

  const activeRoute = trip?.route ?? null;
  const activeRoutePolyline = activeRoute?.polyline ?? null;
  const activeTripProgress = trip?.tripProgress ?? null;

  // Decode passenger route polyline for progress stats calculation
  const decodedRouteCoords = useMemo(() => {
    if (activeRoutePolyline) {
      return decodePolyline(activeRoutePolyline);
    }
    return null;
  }, [activeRoutePolyline]);

  // Passenger client-side projected stats to destination during active ride
  const progressStats = useMemo(() => {
    if (status === 'in_progress' && activeTripProgress != null) {
      return {
        remainingDistanceMeters: activeTripProgress.remainingMeters,
        etaSeconds: activeTripProgress.etaSeconds,
      };
    }

    if (
      status !== 'in_progress' ||
      !driverLocation ||
      !decodedRouteCoords ||
      decodedRouteCoords.length === 0 ||
      !activeRoute
    ) {
      return { remainingDistanceMeters: null, etaSeconds: null };
    }

    const driverPos = { lat: driverLocation.latitude, lng: driverLocation.longitude };
    const remainingDistanceMeters = getDistanceToStepEnd(driverPos, { polyline: decodedRouteCoords });

    const totalDistance = activeRoute.distanceMeters;
    const totalDuration = activeRoute.durationSeconds;

    const etaSeconds = totalDistance > 0 ? totalDuration * (remainingDistanceMeters / totalDistance) : 0;

    return {
      remainingDistanceMeters,
      etaSeconds,
    };
  }, [status, driverLocation, decodedRouteCoords, activeRoute, activeTripProgress]);

  return (
    <View style={styles.root}>
      {/* Interactive Map Background */}
      <LiveMap
        mapRef={mapRef}
        ownLocation={deviceLocation}
        driverLocation={mapData.driverLocation}
        pickupLocation={mapData.pickupLocation}
        destinationLocation={mapData.destinationLocation}
        showDestination={true}
        onPickupDragEnd={phase === 'booking' ? handlePickupDragEnd : undefined}
        onDestinationDragEnd={phase === 'booking' ? handleDestinationDragEnd : undefined}
        pickupKey={pickupDragKey}
        destinationKey={destinationDragKey}
        routePolyline={mapData.routePolyline}
        driverRoutePolyline={mapData.driverRoutePolyline}
        showDriverRoute={mapData.showDriverRoute}
        driverRouteVariant={mapData.driverRouteVariant}
        driverRouteProgressCoordinate={mapData.driverRouteProgressCoordinate}
        bottomPadding={isMinimized ? 160 : 320}
        onMapReady={cameraController.onMapReady}
        onUserPan={cameraController.onUserPan}
      />

      {/* Bottom Sheet Overlays */}
      {status === null ? (
        // Booking Flow sheets
        searchMode ? (
          // Full-screen search overlay.
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
                isLoadingRoute={isLoading || isFetching}
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
          <TripSheet
            status={status}
            onDismiss={handleDismissTerminal}
            remainingDistanceMeters={progressStats.remainingDistanceMeters}
            etaSeconds={progressStats.etaSeconds}
          />
        ) : (
          <SafeAreaView edges={['bottom']} style={styles.sheetArea} pointerEvents="box-none">
            <View style={[styles.sheetCard, shadow.float]}>
              <TripSheet
                status={status}
                onDismiss={handleDismissTerminal}
                remainingDistanceMeters={progressStats.remainingDistanceMeters}
                etaSeconds={progressStats.etaSeconds}
              />
            </View>
          </SafeAreaView>
        )
      )}
      {isLocationLoading && <LocationLoader theme="passenger" />}
    </View>
  );
}

type TripSheetProps = {
  status: TripStatus | null;
  onDismiss: () => void;
  remainingDistanceMeters: number | null;
  etaSeconds: number | null;
};

function TripSheet({
  status,
  onDismiss,
  remainingDistanceMeters,
  etaSeconds,
}: TripSheetProps) {
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
      return (
        <InTripSheet
          remainingDistanceMeters={remainingDistanceMeters}
          etaSeconds={etaSeconds}
        />
      );
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
