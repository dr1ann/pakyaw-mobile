/**
 * Passenger ride screen — (passenger)/index.tsx
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
import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, LayoutAnimation, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import MapView from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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
import {
  isRoadAccessibleCoordinate,
  reverseGeocode,
  reverseGeocodePin,
} from '@pakyaw/shared/features/maps/services/placesService';
import { CancelledSheet } from '@pakyaw/shared/features/trip/components/CancelledSheet';
import { CompletedSheet } from '@pakyaw/shared/features/trip/components/CompletedSheet';
import { DriverMatchedSheet } from '@/features/trip/components/DriverMatchedSheet';
import { LiveMap } from '@pakyaw/shared/features/trip/components/LiveMap';
import { useActiveTrip } from '@pakyaw/shared/features/trip/hooks/useActiveTrip';
import { useDriverLocation } from '@/features/trip/hooks/useDriverLocation';
import type { TripStatus } from '@pakyaw/shared/features/trip/types';
import type { Place } from '@pakyaw/shared/types/place';
import { haversineMeters } from '@pakyaw/shared/lib/geo';
import { getDistanceToStepEnd } from '@pakyaw/shared/lib/geoProjection';
import { logger } from '@pakyaw/shared/lib/logger';
import { decodePolyline } from '@pakyaw/shared/lib/maps/decodePolyline';
import { isInServiceArea } from '@/lib/serviceArea';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { routeMatchesInputs, useBookingDraftStore } from '@/stores/bookingDraftStore';
import { selectPassengerRideMapData } from '@/features/maps/lib/passengerRideMapData';

function isSameCoordinate(
  a: { readonly lat?: number; readonly latitude?: number; readonly lng?: number; readonly longitude?: number } | null | undefined,
  b: { readonly lat?: number; readonly latitude?: number; readonly lng?: number; readonly longitude?: number } | null | undefined
): boolean {
  if (!a || !b) return false;
  const latA = a.lat ?? a.latitude;
  const lngA = a.lng ?? a.longitude;
  const latB = b.lat ?? b.latitude;
  const lngB = b.lng ?? b.longitude;
  if (latA === undefined || lngA === undefined || latB === undefined || lngB === undefined) return false;
  return Math.abs(latA - latB) < 1e-6 && Math.abs(lngA - lngB) < 1e-6;
}

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
  const [searchMode, setSearchMode] = useState<'pickup' | 'destination' | null>(null);
  const [pinTarget, setPinTarget] = useState<'pickup' | 'destination' | null>(null);
  const [pinSelection, setPinSelection] = useState<Place | null>(null);
  const [pinAccessibility, setPinAccessibility] = useState<'checking' | 'accessible' | 'inaccessible'>('checking');
  const [isMinimized, setIsMinimized] = useState(false);
  const [pickupDragKey, setPickupDragKey] = useState(0);
  const [destinationDragKey, setDestinationDragKey] = useState(0);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const deviceLocation = useLocationStore((s) => s.location);
  const permissionStatus = useLocationStore((s) => s.permissionStatus);

  const mapRef = useRef<MapView>(null);
  const geocodeDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (geocodeDebounceTimer.current) {
        clearTimeout(geocodeDebounceTimer.current);
      }
    };
  }, []);

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
  const pickupCoords = trip?.pickup?.coords;
  const driverDistanceFromPickup = useMemo(() => {
    if (!driverLocation || !pickupCoords) return null;
    return haversineMeters(
      { lat: driverLocation.latitude, lng: driverLocation.longitude },
      pickupCoords
    );
  }, [driverLocation, pickupCoords]);

  const routeIsCurrent = useMemo(() => routeMatchesInputs({
    pickup: draft.pickup,
    destination: draft.destination,
    route: draft.route,
  }), [draft.pickup, draft.destination, draft.route]);

  const mapData = useMemo(() => selectPassengerRideMapData({
    phase,
    draft,
    routeIsCurrent,
    trip,
    interpolatedDriverLocation,
    driverDistanceFromPickup,
  }), [phase, draft, routeIsCurrent, trip, interpolatedDriverLocation, driverDistanceFromPickup]);

  const isPinMode = pinTarget !== null && pinSelection !== null;

  const cameraController = useRideCameraController(mapRef, {
    pickupLocation: isPinMode ? null : mapData.pickupLocation,
    destinationLocation: isPinMode ? null : mapData.destinationLocation,
    driverLocation: mapData.driverLocation,
    ownLocation: isPinMode ? null : deviceLocation,
    phase,
    bottomPadding: isMinimized ? 160 : 320,
    overviewCoordinates: useMemo(() => {
      if (isPinMode || phase !== 'active' || !trip) return null;
      const tripStatus = trip.status;
      const isPrePickupOrArrived =
        tripStatus === 'accepted' ||
        tripStatus === 'driver_arriving' ||
        tripStatus === 'driver_arrived';

      if (isPrePickupOrArrived) {
        const coords: { latitude: number; longitude: number }[] = [];
        if (mapData.driverLocation) coords.push(mapData.driverLocation);
        if (mapData.pickupLocation) coords.push(mapData.pickupLocation);
        return coords.length > 0 ? coords : null;
      }

      if (tripStatus === 'in_progress') {
        const coords: { latitude: number; longitude: number }[] = [];
        if (mapData.driverLocation) coords.push(mapData.driverLocation);
        if (mapData.destinationLocation) coords.push(mapData.destinationLocation);
        return coords.length > 0 ? coords : null;
      }

      return null;
    }, [isPinMode, phase, trip, mapData.driverLocation, mapData.pickupLocation, mapData.destinationLocation]),
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
  const handlePickupDragEnd = async (coords: { latitude: number; longitude: number }) => {
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
        const place = await reverseGeocodePin(coords.latitude, coords.longitude);
        if (place) {
          const currentPickup = useBookingDraftStore.getState().draft.pickup;
          if (isSameCoordinate(currentPickup?.coords, coords)) {
            setPickup(place);
          }
        }
      } catch (err) {
        logger.error('[RideScreen] Failed to reverse-geocode dragged pickup coords', err);
      }
    })();
  };

  // Draggable destination pin callback with strict service-area validation
  const handleDestinationDragEnd = async (coords: { latitude: number; longitude: number }) => {
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
        const place = await reverseGeocodePin(coords.latitude, coords.longitude);
        if (place) {
          const currentDest = useBookingDraftStore.getState().draft.destination;
          if (isSameCoordinate(currentDest?.coords, coords)) {
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
    if (isPinMode) {
      const newCoords = { lat: region.latitude, lng: region.longitude };
      // Immediate coordinate update with truthful generic label while moving
      setPinSelection({
        coords: newCoords,
        label: 'Pinned location',
        address: 'Ormoc City, Leyte',
      });
      setPinAccessibility('checking');
      setIsGeocoding(true);

      if (geocodeDebounceTimer.current) {
        clearTimeout(geocodeDebounceTimer.current);
      }

      geocodeDebounceTimer.current = setTimeout(() => {
        void (async () => {
          try {
            const [place, isAccessible] = await Promise.all([
              reverseGeocodePin(region.latitude, region.longitude),
              isRoadAccessibleCoordinate(region.latitude, region.longitude),
            ]);
            if (place) {
              setPinSelection((current: Place | null) => {
                if (current && isSameCoordinate(current.coords, newCoords)) {
                  return place;
                }
                return current;
              });
            }
            setPinSelection((current: Place | null) => {
              if (current && isSameCoordinate(current.coords, newCoords)) {
                setPinAccessibility(isAccessible ? 'accessible' : 'inaccessible');
              }
              return current;
            });
          } catch (err) {
            logger.error('[RideScreen] Failed to reverse-geocode map center coordinate', err);
          } finally {
            setIsGeocoding(false);
          }
        })();
      }, 400);
    }
  };

  const handleConfirmPinning = () => {
    const isPickup = pinTarget === 'pickup';
    const placeToSave = pinSelection || (isPickup ? draft.pickup : draft.destination);

    if (!placeToSave || !placeToSave.coords) {
      Alert.alert('Invalid Location', 'Please select a valid point on the map.');
      return;
    }

    if (!isInServiceArea(placeToSave.coords)) {
      Alert.alert(
        'Service Area',
        'Pakyaw currently serves locations within Ormoc City. Please move the pin within Ormoc.'
      );
      return;
    }

    if (isPickup) {
      setPickup(placeToSave);
    } else {
      setDestination(placeToSave);
      setIsMinimized(false);
    }
    setPinSelection(null);
    setPinTarget(null);
    setPinAccessibility('checking');
    setSearchMode(null);
  };

  const handleCancelPinning = useCallback(() => {
    const target = pinTarget;
    setPinSelection(null);
    setPinTarget(null);
    setPinAccessibility('checking');
    setSearchMode(target);
  }, [pinTarget]);

  function handleDismissTerminal() {
    useBookingDraftStore.getState().reset();
    useActiveTripStore.getState().clearTrip();
  }

  const handleViewActivity = useCallback(() => {
    handleDismissTerminal();
    router.push('/activity');
  }, []);

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

  useEffect(() => {
    const onBackPress = () => {
      if (isPinMode) {
        handleCancelPinning();
        return true;
      }
      if (searchMode === 'pickup' || searchMode === 'destination') {
        setSearchMode(null);
        return true;
      }
      if (draft.destination && !tripId) {
        setDestination(null);
        setRoute(null);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [isPinMode, searchMode, draft.destination, tripId, setDestination, setRoute, handleCancelPinning]);

  const activePinPlace = pinSelection;
  const isPinOutsideServiceArea = Boolean(activePinPlace?.coords && !isInServiceArea(activePinPlace.coords));

  return (
    <View style={styles.root}>
      {/* Interactive Map Background */}
      <LiveMap
        mapRef={mapRef}
        ownLocation={deviceLocation}
        driverLocation={mapData.driverLocation}
        pickupLocation={isPinMode ? null : mapData.pickupLocation}
        destinationLocation={isPinMode ? null : mapData.destinationLocation}
        showDestination={!isPinMode}
        onPickupDragEnd={phase === 'booking' && !isPinMode ? handlePickupDragEnd : undefined}
        onDestinationDragEnd={phase === 'booking' && !isPinMode ? handleDestinationDragEnd : undefined}
        onRegionChangeComplete={handleMapRegionChangeComplete}
        pickupKey={pickupDragKey}
        destinationKey={destinationDragKey}
        routePolyline={isPinMode ? null : mapData.routePolyline}
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
              {activePinPlace?.label || (pinTarget === 'pickup' ? 'Set Pickup' : 'Set Destination')}
            </Text>
          </View>
          <SymbolIcon
            name="mappin"
            size={40}
            tintColor={pinTarget === 'pickup' ? colors.blue.primary : colors.amber.primary}
          />
        </View>
      )}

      {/* Bottom Sheet Overlays */}
      {status === null ? (
        // Booking Flow sheets
        searchMode === 'pickup' || searchMode === 'destination' ? (
          // Full-screen search overlay
          <View key="location-search" style={styles.fullscreenSearchOverlay}>
            <SafeAreaView style={styles.fullscreenSearch} edges={['top', 'left', 'right']}>
              <SetDestinationSheet
                mode={searchMode === 'pickup' ? 'pickup' : 'destination'}
                onClose={() => setSearchMode(null)}
                onChooseOnMap={(coords) => {
                  const isPickup = searchMode === 'pickup';
                  setPinSelection({
                    label: 'Pinned location',
                    address: 'Ormoc City, Leyte',
                    coords,
                  });
                  setPinAccessibility('checking');
                  setPinTarget(isPickup ? 'pickup' : 'destination');
                  setSearchMode(null);
                  setIsMinimized(false);

                  setIsGeocoding(true);
                  void (async () => {
                    try {
                      const [place, isAccessible] = await Promise.all([
                        reverseGeocodePin(coords.lat, coords.lng),
                        isRoadAccessibleCoordinate(coords.lat, coords.lng),
                      ]);
                      if (place) {
                        setPinSelection((current: Place | null) => {
                          if (current && isSameCoordinate(current.coords, coords)) {
                            return place;
                          }
                          return current;
                        });
                      }
                      setPinSelection((current: Place | null) => {
                        if (current && isSameCoordinate(current.coords, coords)) {
                          setPinAccessibility(isAccessible ? 'accessible' : 'inaccessible');
                        }
                        return current;
                      });
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
          </View>
        ) : isPinMode ? (
          // Map Pinning Confirmation Card
          <View key="pin-selection" style={styles.sheetArea} pointerEvents="box-none">
            <View style={[styles.pinConfirmCard, shadow.float]}>
              <View style={styles.pinHeaderRow}>
                <SymbolIcon
                  name={pinTarget === 'pickup' ? 'mappin.circle.fill' : 'flag.fill'}
                  size={20}
                  tintColor={pinTarget === 'pickup' ? colors.blue.primary : colors.amber.primary}
                />
                <Text style={styles.pinTitle}>
                  {pinTarget === 'pickup' ? 'Set Pickup Location' : 'Set Destination Location'}
                </Text>
              </View>

              <View style={styles.pinAddressBox}>
                <Text style={styles.pinAddressLabel} numberOfLines={1}>
                  {activePinPlace?.label || 'Pinned location'}
                </Text>
                {activePinPlace?.address ? (
                  <Text style={styles.pinAddressSub} numberOfLines={2}>
                    {activePinPlace.address}
                  </Text>
                ) : isGeocoding ? (
                  <Text style={styles.pinAddressSub} numberOfLines={1}>
                    Resolving location…
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

              {!isPinOutsideServiceArea && pinAccessibility === 'inaccessible' && (
                <View style={styles.serviceAreaWarning}>
                  <SymbolIcon name="exclamationmark.triangle.fill" size={14} tintColor={colors.danger} />
                  <Text style={styles.serviceAreaWarningText}>
                    Move the pin onto a mapped road or accessible land location
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
                  disabled={!activePinPlace?.coords || isPinOutsideServiceArea}
                  style={styles.confirmPinButton}
                />
              </View>
            </View>
          </View>
        ) : draft.destination ? (
          // Mount a fresh native layout when leaving the pin card. Its content-sized
          // container must not be reused for the full-height, clipped booking panel.
          <View key="booking" style={styles.bookingSheetArea} pointerEvents="box-none">
            <View style={[
              styles.bookingSheetCard,
              isMinimized && styles.bookingSheetCardMinimized,
              shadow.float
            ]}>
              <BookingSheetErrorBoundary
                onReset={() => {
                  setDestination(null);
                  setRoute(null);
                }}
                destinationLabel={draft.destination?.label}
              >
                <BookingSheet
                  onSearchPickup={() => setSearchMode('pickup')}
                  onSearchDestination={() => setSearchMode('destination')}
                  isMinimized={isMinimized}
                  onToggleMinimize={handleToggleMinimize}
                  isLoadingRoute={isLoading || isFetching}
                />
              </BookingSheetErrorBoundary>
            </View>
          </View>
        ) : (
          // Home sheet ("Where to?")
          <View key="home" style={styles.sheetArea} pointerEvents="box-none">
            <HomeSheet
              onSearchPress={() => setSearchMode('destination')}
              onPickupPress={() => setSearchMode('pickup')}
              firstName={profile?.firstName}
              fullName={profile?.name}
              pickupLabel={draft.pickup?.label}
              isLocatingPickup={isLocationLoading}
              locationPermissionDenied={permissionStatus === 'denied'}
            />
          </View>
        )
      ) : (
        // Active Trip Sheets (Status-driven)
        isSheetSelfContained ? (
          <TripSheet
            status={status}
            onDismiss={handleDismissTerminal}
            onViewActivity={handleViewActivity}
            remainingDistanceMeters={progressStats.remainingDistanceMeters}
            etaSeconds={progressStats.etaSeconds}
          />
        ) : (
          <View style={styles.sheetArea} pointerEvents="box-none">
            <TripSheet
              status={status}
              onDismiss={handleDismissTerminal}
              onViewActivity={handleViewActivity}
              remainingDistanceMeters={progressStats.remainingDistanceMeters}
              etaSeconds={progressStats.etaSeconds}
            />
          </View>
        )
      )}
      {isLocationLoading && <LocationLoader theme="passenger" />}
    </View>
  );
}

class BookingSheetErrorBoundary extends Component<
  {
    readonly children: React.ReactNode;
    readonly onReset: () => void;
    readonly destinationLabel?: string | null;
  },
  { hasError: boolean; error: Error | null }
> {
  state: { hasError: boolean; error: Error | null } = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('[BookingSheetErrorBoundary] Caught render error in BookingSheet', { error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorFallbackContainer}>
          <View style={styles.errorFallbackHeader}>
            <SymbolIcon name="exclamationmark.triangle.fill" size={28} tintColor={colors.danger} />
            <Text style={styles.errorFallbackTitle}>Unable to load booking</Text>
            <Text style={styles.errorFallbackSubtitle}>
              {this.state.error?.message || 'A layout error occurred while opening the booking sheet.'}
            </Text>
          </View>
          <View style={styles.errorFallbackRouteBox}>
            <Text style={styles.errorFallbackRouteLabel} numberOfLines={1}>
              To: {this.props.destinationLabel || 'Selected Destination'}
            </Text>
          </View>
          <View style={styles.errorFallbackActions}>
            <Button
              label="Retry"
              onPress={() => this.setState({ hasError: false, error: null })}
              style={styles.errorFallbackButton}
            />
            <Button
              label="Choose Another Destination"
              variant="outline"
              onPress={this.props.onReset}
              style={styles.errorFallbackButton}
            />
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

type TripSheetProps = {
  status: TripStatus | null;
  onDismiss: () => void;
  onViewActivity?: () => void;
  remainingDistanceMeters: number | null;
  etaSeconds: number | null;
};

function TripSheet({
  status,
  onDismiss,
  onViewActivity,
  remainingDistanceMeters,
  etaSeconds,
}: TripSheetProps) {
  switch (status) {
    case 'requested':
      return <SearchingSheet />;
    case 'accepted':
    case 'driver_arriving':
    case 'driver_arrived':
    case 'in_progress':
      return (
        <DriverMatchedSheet
          remainingDistanceMeters={remainingDistanceMeters}
          etaSeconds={etaSeconds}
        />
      );
    case 'completed':
      return <CompletedSheet onDismiss={onDismiss} onViewActivity={onViewActivity} />;
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
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  bookingSheetCard: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    height: '85%',
    overflow: 'hidden',
  },
  bookingSheetCardMinimized: {
    height: 200,
  },
  fullscreenSearchOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: colors.surface.card,
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
  errorFallbackContainer: {
    flex: 1,
    padding: spacing[5],
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface.card,
  },
  errorFallbackHeader: {
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  errorFallbackTitle: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginTop: spacing[2],
    textAlign: 'center',
  },
  errorFallbackSubtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    textAlign: 'center',
    marginTop: spacing[1],
  },
  errorFallbackRouteBox: {
    backgroundColor: colors.surface.muted,
    padding: spacing[3],
    borderRadius: radius.md,
    width: '100%',
    marginBottom: spacing[4],
  },
  errorFallbackRouteLabel: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.medium,
    color: colors.ink[700],
  },
  errorFallbackActions: {
    width: '100%',
    gap: spacing[2],
  },
  errorFallbackButton: {
    width: '100%',
  },
});
