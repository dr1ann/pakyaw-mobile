/**
 * Passenger ride screen — (passenger)/index.tsx
 *
 * Phase 12D: Map-Driven Booking & Figma Alignment.
 *
 * The screen manages the passenger booking flow and active trip states.
 * Under Phase 12, the passenger booking flow is fully map-driven:
 *   - No active trip:
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
import { Alert, LayoutAnimation, Modal, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocationLoader } from '@pakyaw/shared/components/ui/LocationLoader';
import { Button } from '@pakyaw/shared/components/ui/Button';
import { MapActionButton } from '@pakyaw/shared/components/ui/MapActionButton';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useSession } from '@pakyaw/shared/features/auth/hooks/useSession';
import { getUserDoc } from '@pakyaw/shared/features/auth/services/auth.service';
import type { UserDoc } from '@pakyaw/shared/features/auth/types';
import { BookingSheet } from '@/features/booking/components/BookingSheet';
import { HomeSheet } from '@/features/booking/components/HomeSheet';
import { SearchingSheet } from '@/features/booking/components/SearchingSheet';
import { SetDestinationSheet } from '@/features/booking/components/SetDestinationSheet';
import { useRouteQuery } from '@/features/maps/hooks/useRouteQuery';
import { reverseGeocode } from '@pakyaw/shared/features/maps/services/placesService';
import { CancelledSheet } from '@pakyaw/shared/features/trip/components/CancelledSheet';
import { CompletedSheet } from '@pakyaw/shared/features/trip/components/CompletedSheet';
import { DriverMatchedSheet } from '@/features/trip/components/DriverMatchedSheet';
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

export default function RideScreen() {
  const insets = useSafeAreaInsets();
  const trip = useActiveTripStore((s) => s.trip);
  const tripId = useActiveTripStore((s) => s.tripId);
  const driverLocation = useActiveTripStore((s) => s.driverLocation);
  const draft = useBookingDraftStore((s) => s.draft);
  const setPickup = useBookingDraftStore((s) => s.setPickup);
  const setDestination = useBookingDraftStore((s) => s.setDestination);
  const setRoute = useBookingDraftStore((s) => s.setRoute);

  const { uid } = useSession();
  const [searchMode, setSearchMode] = useState<'pickup' | 'destination' | 'pin_pickup' | 'pin_destination' | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [pickupDragKey, setPickupDragKey] = useState(0);
  const [destinationDragKey, setDestinationDragKey] = useState(0);
  const [isGeocoding, setIsGeocoding] = useState(false);

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

  // Smooth the passenger-facing driver marker between GPS updates
  const interpolatedDriverLocation = useInterpolatedCoordinate(driverLocation);

  // Distance from driver to trip pickup
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

    const tripStatus = trip?.status;
    const isPrePickup = tripStatus === 'accepted' || tripStatus === 'driver_arriving';
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

    const PICKUP_FADE_DISTANCE_M = 150;
    const shouldShowPickup =
      isPrePickup ||
      isArrived ||
      (isInTrip &&
        (driverDistanceFromPickup == null ||
          driverDistanceFromPickup < PICKUP_FADE_DISTANCE_M));

    const liveDriverRoute = trip?.driverRoute?.polyline ?? null;
    let showDriverRoute = false;
    let driverRoutePolyline: string | null = null;
    let routePolyline: string | null = null;
    let driverRouteVariant: 'pickup' | 'trip' = 'pickup';

    if (isPrePickup) {
      showDriverRoute = liveDriverRoute != null;
      driverRoutePolyline = liveDriverRoute;
      driverRouteVariant = 'pickup';
      routePolyline = null;
    } else if (isArrived) {
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

  // Sync query route data to bookingDraftStore
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

  // Draggable pickup pin callback with strict service-area validation
  const handlePickupDragEnd = (coords: { latitude: number; longitude: number }) => {
    if (!isInServiceArea(coords)) {
      logger.warn('[RideScreen] Dragged pickup pin outside service area, blocking update', coords);
      Alert.alert(
        'Service Area',
        'Pakyaw currently serves locations within Ormoc City.'
      );
      setPickupDragKey((k) => k + 1);
      return;
    }

    logger.info('[RideScreen] Pickup pin drag ended inside Ormoc, updating store immediately', coords);
    setPickup({
      coords: { lat: coords.latitude, lng: coords.longitude },
      label: 'Pinned location',
    });

    void (async () => {
      try {
        const place = await reverseGeocode(coords.latitude, coords.longitude);
        if (place) {
          const currentPickup = useBookingDraftStore.getState().draft.pickup;
          if (
            currentPickup?.coords?.lat === coords.latitude &&
            currentPickup?.coords?.lng === coords.longitude
          ) {
            setPickup(place);
          }
        }
      } catch (err) {
        logger.error('[RideScreen] Failed to reverse-geocode dragged pickup coords', err);
      }
    })();
  };

  // Draggable destination pin callback with strict service-area validation
  const handleDestinationDragEnd = (coords: { latitude: number; longitude: number }) => {
    if (!isInServiceArea(coords)) {
      logger.warn('[RideScreen] Dragged destination pin outside service area, blocking update', coords);
      Alert.alert(
        'Service Area',
        'Pakyaw currently serves locations within Ormoc City.'
      );
      setDestinationDragKey((k) => k + 1);
      return;
    }

    logger.info('[RideScreen] Destination pin drag ended inside Ormoc, updating store immediately', coords);
    setDestination({
      coords: { lat: coords.latitude, lng: coords.longitude },
      label: 'Pinned location',
    });

    void (async () => {
      try {
        const place = await reverseGeocode(coords.latitude, coords.longitude);
        if (place) {
          const currentDest = useBookingDraftStore.getState().draft.destination;
          if (
            currentDest?.coords?.lat === coords.latitude &&
            currentDest?.coords?.lng === coords.longitude
          ) {
            setDestination(place);
          }
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

  const handleMapRegionChangeComplete = (region: { latitude: number; longitude: number }) => {
    if (searchMode === 'pin_pickup') {
      setIsGeocoding(true);
      setPickup({
        coords: { lat: region.latitude, lng: region.longitude },
        label: 'Pinned location',
      });
      void (async () => {
        try {
          const place = await reverseGeocode(region.latitude, region.longitude);
          if (place) {
            const currentPickup = useBookingDraftStore.getState().draft.pickup;
            if (
              currentPickup?.coords?.lat === region.latitude &&
              currentPickup?.coords?.lng === region.longitude
            ) {
              setPickup(place);
            }
          }
        } catch (err) {
          logger.error('[RideScreen] Failed to reverse-geocode map center pickup', err);
        } finally {
          setIsGeocoding(false);
        }
      })();
    } else if (searchMode === 'pin_destination') {
      setIsGeocoding(true);
      setDestination({
        coords: { lat: region.latitude, lng: region.longitude },
        label: 'Pinned location',
      });
      void (async () => {
        try {
          const place = await reverseGeocode(region.latitude, region.longitude);
          if (place) {
            const currentDest = useBookingDraftStore.getState().draft.destination;
            if (
              currentDest?.coords?.lat === region.latitude &&
              currentDest?.coords?.lng === region.longitude
            ) {
              setDestination(place);
            }
          }
        } catch (err) {
          logger.error('[RideScreen] Failed to reverse-geocode map center destination', err);
        } finally {
          setIsGeocoding(false);
        }
      })();
    }
  };

  const handleConfirmPinning = () => {
    if (isGeocoding) return;

    const isPickup = searchMode === 'pin_pickup';
    const currentPlace = isPickup ? draft.pickup : draft.destination;

    if (!currentPlace || !currentPlace.coords) {
      Alert.alert('Invalid Location', 'Please select a valid point on the map.');
      return;
    }

    if (!isInServiceArea(currentPlace.coords)) {
      Alert.alert(
        'Service Area',
        'Pakyaw currently serves locations within Ormoc City. Please move the pin within Ormoc.'
      );
      return;
    }

    setSearchMode(null);
  };

  const handleCancelPinning = () => {
    const isPickup = searchMode === 'pin_pickup';
    if (isPickup) {
      setSearchMode('pickup');
    } else {
      setSearchMode('destination');
    }
  };

  function handleDismissTerminal() {
    useBookingDraftStore.getState().reset();
    useActiveTripStore.getState().clearTrip();
  }

  const status = trip?.status ?? (tripId ? 'requested' : null);
  const isSheetSelfContained = status === null || status === 'requested';

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

  const isPinMode = searchMode === 'pin_pickup' || searchMode === 'pin_destination';
  const activePinPlace = searchMode === 'pin_pickup' ? draft.pickup : draft.destination;
  const isPinOutsideServiceArea = Boolean(activePinPlace?.coords && !isInServiceArea(activePinPlace.coords));

  return (
    <View style={styles.root}>
      {/* Interactive Map Background */}
      <LiveMap
        mapRef={mapRef}
        ownLocation={deviceLocation}
        driverLocation={mapData.driverLocation}
        pickupLocation={searchMode === 'pin_pickup' ? null : mapData.pickupLocation}
        destinationLocation={searchMode === 'pin_destination' ? null : mapData.destinationLocation}
        showDestination={true}
        onPickupDragEnd={phase === 'booking' ? handlePickupDragEnd : undefined}
        onDestinationDragEnd={phase === 'booking' ? handleDestinationDragEnd : undefined}
        onRegionChangeComplete={handleMapRegionChangeComplete}
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

      {/* Floating Map Controls */}
      {!isPinMode && (
        <View style={[styles.floatingControls, { top: insets.top + 16 }]} pointerEvents="box-none">
          <MapActionButton
            icon={<SymbolIcon name="location.fill" size={18} tintColor={colors.blue.primary} />}
            onPress={() => cameraController.recenter()}
            accessibilityLabel="Recenter map to my location"
            testID="map-recenter-button"
          />
        </View>
      )}

      {/* Center Pin Overlay for Map Pinning */}
      {isPinMode && (
        <View style={styles.centerPinContainer} pointerEvents="none">
          <View style={styles.centerPinBubble}>
            <Text style={styles.centerPinBubbleText} numberOfLines={1}>
              {searchMode === 'pin_pickup'
                ? draft.pickup?.label || 'Set Pickup'
                : draft.destination?.label || 'Set Destination'}
            </Text>
          </View>
          <SymbolIcon
            name="mappin"
            size={40}
            tintColor={searchMode === 'pin_pickup' ? colors.blue.primary : colors.amber.primary}
          />
        </View>
      )}

      {/* Bottom Sheet Overlays */}
      {status === null ? (
        // Booking Flow sheets
        searchMode === 'pickup' || searchMode === 'destination' ? (
          // Full-screen search overlay
          <Modal
            visible
            animationType="slide"
            statusBarTranslucent
            onRequestClose={() => setSearchMode(null)}
          >
            <SafeAreaProvider>
              <SafeAreaView style={styles.fullscreenSearch}>
                <SetDestinationSheet
                  mode={searchMode === 'pickup' ? 'pickup' : 'destination'}
                  onClose={() => setSearchMode(null)}
                  onChooseOnMap={(coords) => {
                    const isPickup = searchMode === 'pickup';
                    const targetMode = isPickup ? 'pin_pickup' : 'pin_destination';

                    if (isPickup) {
                      setPickup({
                        label: 'Pin Drop Location',
                        address: 'Drag pin to exact location',
                        coords,
                      });
                    } else {
                      setDestination({
                        label: 'Pin Drop Location',
                        address: 'Drag pin to exact location',
                        coords,
                      });
                    }
                    setSearchMode(targetMode);
                    setIsMinimized(false);

                    setIsGeocoding(true);
                    void (async () => {
                      try {
                        const place = await reverseGeocode(coords.lat, coords.lng);
                        if (place) {
                          if (isPickup) setPickup(place);
                          else setDestination(place);
                        }
                      } catch (err) {
                        logger.error('[RideScreen] Failed initial pin drop geocoding', err);
                      } finally {
                        setIsGeocoding(false);
                      }
                    })();
                  }}
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
        ) : isPinMode ? (
          // Map Pinning Confirmation Card
          <SafeAreaView edges={['bottom']} style={styles.sheetArea} pointerEvents="box-none">
            <View style={[styles.pinConfirmCard, shadow.float]}>
              <View style={styles.pinHeaderRow}>
                <SymbolIcon
                  name={searchMode === 'pin_pickup' ? 'mappin.circle.fill' : 'flag.fill'}
                  size={20}
                  tintColor={searchMode === 'pin_pickup' ? colors.blue.primary : colors.amber.primary}
                />
                <Text style={styles.pinTitle}>
                  {searchMode === 'pin_pickup' ? 'Set Pickup Location' : 'Set Destination Location'}
                </Text>
              </View>

              <View style={styles.pinAddressBox}>
                <Text style={styles.pinAddressLabel} numberOfLines={1}>
                  {activePinPlace?.label || 'Pin Drop Location'}
                </Text>
                {activePinPlace?.address ? (
                  <Text style={styles.pinAddressSub} numberOfLines={2}>
                    {activePinPlace.address}
                  </Text>
                ) : null}
              </View>

              {isPinOutsideServiceArea && (
                <View style={styles.serviceAreaWarning}>
                  <SymbolIcon name="exclamationmark.triangle.fill" size={14} tintColor={colors.danger} />
                  <Text style={styles.serviceAreaWarningText}>
                    Outside Ormoc City service area
                  </Text>
                </View>
              )}

              <View style={styles.pinActionsRow}>
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={handleCancelPinning}
                  style={styles.cancelPinButton}
                />
                <Button
                  label="Confirm"
                  onPress={handleConfirmPinning}
                  loading={isGeocoding}
                  disabled={isGeocoding || isPinOutsideServiceArea}
                  style={styles.confirmPinButton}
                />
              </View>
            </View>
          </SafeAreaView>
        ) : draft.destination ? (
          // Booking options sheet
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
          // Home sheet ("Where to?")
          <SafeAreaView edges={['bottom']} style={styles.sheetArea} pointerEvents="box-none">
            <HomeSheet
              onSearchPress={() => setSearchMode('destination')}
              onPickupPress={() => setSearchMode('pickup')}
              firstName={profile?.firstName}
              fullName={profile?.name}
              pickupLabel={draft.pickup?.label}
              isLocatingPickup={isLocationLoading}
              locationPermissionDenied={permissionStatus === 'denied'}
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
}: TripSheetProps) {
  switch (status) {
    case 'requested':
      return <SearchingSheet />;
    case 'accepted':
    case 'driver_arriving':
    case 'driver_arrived':
    case 'in_progress':
      return <DriverMatchedSheet />;
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
  floatingControls: {
    position: 'absolute',
    right: spacing[4],
    zIndex: 100,
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
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  bookingSheetCard: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
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
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -80 }, { translateY: -64 }],
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
  },
  centerPinBubble: {
    backgroundColor: colors.ink[900],
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.md,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: 150,
  },
  centerPinBubbleText: {
    color: colors.white,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },
  pinConfirmCard: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  pinHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  pinTitle: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  pinAddressBox: {
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
    gap: 2,
  },
  pinAddressLabel: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  pinAddressSub: {
    fontSize: typography.size.caption,
    color: colors.ink[500],
  },
  serviceAreaWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: '#FFF5F5',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    marginBottom: spacing[3],
  },
  serviceAreaWarningText: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
    color: colors.danger,
  },
  pinActionsRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  cancelPinButton: {
    flex: 1,
    minHeight: 48,
  },
  confirmPinButton: {
    flex: 2,
    minHeight: 48,
  },
});
