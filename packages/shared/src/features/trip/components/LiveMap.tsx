import { Image } from 'expo-image';
import { useNavigation } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { colors, shadow } from '@/constants/theme';
import { NAV_DRIVER_SCREEN_ANCHOR } from '@pakyaw/shared/features/maps/navigation/constants';
import { splitPolylineAtClosestPoint, type LatLng } from '@pakyaw/shared/lib/geoProjection';
import { logger } from '@pakyaw/shared/lib/logger';
import { decodePolyline } from '@pakyaw/shared/lib/maps/decodePolyline';

export type LiveMapProps = {
  readonly driverLocation?: { latitude: number; longitude: number } | null;
  readonly pickupLocation?: { latitude: number; longitude: number } | null;
  readonly destinationLocation?: { latitude: number; longitude: number } | null;
  readonly showDestination?: boolean;
  readonly ownLocation?: { latitude: number; longitude: number } | null;
  readonly style?: StyleProp<ViewStyle>;
  readonly onPickupDragEnd?: (coords: { readonly latitude: number; readonly longitude: number }) => void;
  readonly onDestinationDragEnd?: (coords: { readonly latitude: number; readonly longitude: number }) => void;
  readonly routePolyline?: string | null;
  readonly driverRoutePolyline?: string | null;
  readonly showDriverRoute?: boolean;
  /**
   * Which leg the driver navigation polyline represents.
   *   'pickup' → pre-pickup leg (driver → pickup), rendered in violet.
   *   'trip'   → in-trip leg (pickup → destination), rendered in blue so the
   *             rider-facing trip route styling is reused for the actual,
   *             live-snapped navigation route. The static booking polyline
   *             should be suppressed by the caller in this mode to avoid
   *             duplicating the route on screen.
   */
  readonly driverRouteVariant?: 'pickup' | 'trip';
  readonly driverRouteProgressCoordinate?: { latitude: number; longitude: number } | null;
  readonly showRouteStatus?: boolean;
  readonly routeStatusLabel?: string;
  readonly bottomPadding?: number;
  readonly pickupKey?: string | number;
  readonly destinationKey?: string | number;
  readonly showNavigationArrow?: boolean;
  /** Pre-computed marker rotation in degrees, relative to camera heading.
   *  Formula: arrowHeading - cameraHeading (shortest arc). Pass 0 when aligned. */
  readonly navigationArrowRotation?: number;
  readonly navigationActive?: boolean;
  readonly navigationBottomInset?: number;
  readonly navigationDriverScreenAnchor?: number;
  readonly freezeNavigationMapPadding?: boolean;
  readonly onUserPan?: () => void;
  readonly mapRef?: React.RefObject<MapView | null>;
  readonly onMapReady?: () => void;
  readonly onRegionChangeComplete?: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }) => void;
  readonly debugTripStatus?: string | null;
  readonly passengerStops?: readonly MapPassengerStop[];
};

export type MapPassengerStop = {
  readonly id: string;
  readonly type: 'pickup' | 'destination';
  readonly passengerName: string;
  readonly location: { latitude: number; longitude: number };
};

const ORMOC_CENTER = {
  latitude: 11.0050,
  longitude: 124.6075,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

type DriverRoutePolylineLayerProps = {
  readonly label: string;
  readonly coordinates: { latitude: number; longitude: number }[];
  readonly strokeWidth: number;
  readonly strokeColor: string;
  readonly debugTripStatus?: string | null;
  readonly debugShowDriverRoute?: boolean;
  readonly debugDriverRoutePolyline?: string | null;
  readonly debugDecodedDriverRouteLength?: number;
};

let mountedDriverRoutePolylineLayers = 0;
let nextDriverRoutePolylineInstanceId = 0;

type LoggedPolylineProps = DriverRoutePolylineLayerProps;

function LoggedPolyline({
  label,
  coordinates,
  strokeWidth,
  strokeColor,
  debugTripStatus,
  debugShowDriverRoute,
  debugDriverRoutePolyline,
  debugDecodedDriverRouteLength,
}: LoggedPolylineProps) {
  const instanceIdRef = useRef<number | null>(null);
  const previousCoordinatesRef = useRef(coordinates);
  const initialSnapshotRef = useRef({
    label,
    tripStatus: debugTripStatus,
    showDriverRoute: debugShowDriverRoute,
    driverRoutePolyline: debugDriverRoutePolyline,
    decodedRouteLength: debugDecodedDriverRouteLength,
    coordinatesLength: coordinates.length,
  });

  useEffect(() => {
    if (instanceIdRef.current == null) {
      nextDriverRoutePolylineInstanceId += 1;
      instanceIdRef.current = nextDriverRoutePolylineInstanceId;
    }

    const initialSnapshot = initialSnapshotRef.current;

    logger.info('[LiveMap] Polyline mounted', {
      label: initialSnapshot.label,
      instanceId: instanceIdRef.current,
      tripStatus: initialSnapshot.tripStatus,
      showDriverRoute: initialSnapshot.showDriverRoute,
      driverRoutePolyline: initialSnapshot.driverRoutePolyline,
      decodedRouteLength: initialSnapshot.decodedRouteLength,
      coordinatesLength: initialSnapshot.coordinatesLength,
    });

    return () => {
      logger.info('[LiveMap] Polyline unmounted', {
        label: initialSnapshot.label,
        instanceId: instanceIdRef.current,
      });
    };
  }, []);

  useEffect(() => {
    logger.info('[LiveMap] Polyline committed', {
      label: initialSnapshotRef.current.label,
      instanceId: instanceIdRef.current,
      coordinatesLength: coordinates.length,
      coordinatesRefChanged: previousCoordinatesRef.current !== coordinates,
      tripStatus: debugTripStatus,
      showDriverRoute: debugShowDriverRoute,
      driverRoutePolyline: debugDriverRoutePolyline,
      decodedRouteLength: debugDecodedDriverRouteLength,
      strokeWidth,
      strokeColor,
    });
    previousCoordinatesRef.current = coordinates;
  }, [
    label,
    coordinates,
    strokeWidth,
    strokeColor,
    debugTripStatus,
    debugShowDriverRoute,
    debugDriverRoutePolyline,
    debugDecodedDriverRouteLength,
  ]);

  return (
    <Polyline
      coordinates={coordinates}
      strokeWidth={strokeWidth}
      strokeColor={strokeColor}
    />
  );
}

function DriverRoutePolylineLayer({
  label,
  coordinates,
  strokeWidth,
  strokeColor,
  debugTripStatus,
  debugShowDriverRoute,
  debugDriverRoutePolyline,
  debugDecodedDriverRouteLength,
}: DriverRoutePolylineLayerProps) {
  const instanceIdRef = useRef<number>(0);
  const previousCoordinatesRef = useRef(coordinates);
  const initialSnapshotRef = useRef({
    label,
    tripStatus: debugTripStatus,
    showDriverRoute: debugShowDriverRoute,
    driverRoutePolyline: debugDriverRoutePolyline,
    decodedRouteLength: debugDecodedDriverRouteLength,
    coordinatesLength: coordinates.length,
  });

  useEffect(() => {
    if (instanceIdRef.current == null) {
      nextDriverRoutePolylineInstanceId += 1;
      instanceIdRef.current = nextDriverRoutePolylineInstanceId;
    }

    const initialSnapshot = initialSnapshotRef.current;

    mountedDriverRoutePolylineLayers += 1;
    logger.info('[LiveMap] driver-route polyline mounted', {
      label: initialSnapshot.label,
      instanceId: instanceIdRef.current,
      tripStatus: initialSnapshot.tripStatus,
      showDriverRoute: initialSnapshot.showDriverRoute,
      driverRoutePolyline: initialSnapshot.driverRoutePolyline,
      decodedRouteLength: initialSnapshot.decodedRouteLength,
      mountedDriverRoutePolylineLayers,
      pointCount: initialSnapshot.coordinatesLength,
    });

    return () => {
      mountedDriverRoutePolylineLayers = Math.max(0, mountedDriverRoutePolylineLayers - 1);
      logger.info('[LiveMap] driver-route polyline unmounted', {
        label: initialSnapshot.label,
        instanceId: instanceIdRef.current,
      });
    };
  }, []);

  useEffect(() => {
    logger.info('[LiveMap] driver-route polyline committed', {
      label: initialSnapshotRef.current.label,
      instanceId: instanceIdRef.current,
      coordinatesLength: coordinates.length,
      coordinatesRefChanged: previousCoordinatesRef.current !== coordinates,
      showDriverRoute: debugShowDriverRoute,
      driverRoutePolyline: debugDriverRoutePolyline,
      decodedRouteLength: debugDecodedDriverRouteLength,
      tripStatus: debugTripStatus,
    });
    previousCoordinatesRef.current = coordinates;
  }, [
    label,
    coordinates,
    debugShowDriverRoute,
    debugDriverRoutePolyline,
    debugDecodedDriverRouteLength,
    debugTripStatus,
  ]);

  return (
    <LoggedPolyline
      label={label}
      coordinates={coordinates}
      strokeWidth={strokeWidth}
      strokeColor={strokeColor}
      debugTripStatus={debugTripStatus}
      debugShowDriverRoute={debugShowDriverRoute}
      debugDriverRoutePolyline={debugDriverRoutePolyline}
      debugDecodedDriverRouteLength={debugDecodedDriverRouteLength}
    />
  );
}

export function LiveMap({
  driverLocation,
  pickupLocation,
  destinationLocation,
  showDestination = true,
  ownLocation,
  style,
  onPickupDragEnd,
  routePolyline,
  driverRoutePolyline,
  showDriverRoute = false,
  driverRouteVariant = 'pickup',
  driverRouteProgressCoordinate,
  showRouteStatus = false,
  routeStatusLabel = 'Finding route...',
  onDestinationDragEnd,
  pickupKey,
  destinationKey,
  showNavigationArrow = false,
  navigationArrowRotation = 0,
  navigationActive = false,
  navigationBottomInset = 320,
  navigationDriverScreenAnchor = NAV_DRIVER_SCREEN_ANCHOR,
  freezeNavigationMapPadding = false,
  onUserPan,
  mapRef: externalMapRef,
  onMapReady,
  onRegionChangeComplete,
  debugTripStatus = null,
  passengerStops = [],
}: LiveMapProps) {
  const localMapRef = useRef<MapView>(null);
  const mapRef = externalMapRef || localMapRef;

  const navigationObj = useNavigation();
  const [focusKey, setFocusKey] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [longitudeDelta, setLongitudeDelta] = useState(0.015);

  const arrowSize = React.useMemo(() => {
    // We use discrete sizes to prevent too many re-renders while ensuring
    // the marker is recreated via its key to avoid clipping/drawing bugs on Android.
    if (longitudeDelta < 0.006) {
      return 48; // Zoomed in (maximum size)
    } else if (longitudeDelta < 0.018) {
      return 38; // Medium zoom
    } else {
      return 30; // Zoomed out (minimum size, won't get too small)
    }
  }, [longitudeDelta]);

  // Compute mapPadding so the camera anchor (where `center` lands) is biased
  // toward the upper portion of the visible map. With Google Maps' mapPadding,
  // the anchor sits at the centroid of the *unpadded* rect, so a tall top
  // inset pushes the camera target downward on screen — placing the driver
  // marker low (Grab / Google Maps navigation feel) while the road ahead fills
  // the upper view. Only applied during Navigation Mode; overview framing uses
  // unpadded fits so it isn't distorted.
  //
  // Computed inline (via useMemo) rather than state + rAF so the padding is
  // committed to the native MapView during the render commit phase — BEFORE
  // the camera controller's useEffect fires the engagement animation. With the
  // previous state+rAF approach, the padding lagged by one animation frame,
  // causing the camera to animate to the screen center (zero padding) instead
  // of the biased navigation anchor position.
  const lastNavigationMapPaddingRef = useRef({ top: 0, right: 0, bottom: 0, left: 0 });

  const navigationMapPadding = React.useMemo(() => {
    if (freezeNavigationMapPadding) {
      return lastNavigationMapPaddingRef.current;
    }

    if (!navigationActive || containerHeight <= 0) {
      const zero = { top: 0, right: 0, bottom: 0, left: 0 };
      lastNavigationMapPaddingRef.current = zero;
      return zero;
    }

    const visibleHeight = Math.max(0, containerHeight - navigationBottomInset);
    const anchorOffset = Math.max(0, 2 * navigationDriverScreenAnchor - 1) * visibleHeight;
    const padding = {
      top: Math.round(anchorOffset),
      right: 0,
      bottom: Math.round(navigationBottomInset),
      left: 0,
    };
    lastNavigationMapPaddingRef.current = padding;
    return padding;
  }, [
    freezeNavigationMapPadding,
    navigationActive,
    containerHeight,
    navigationBottomInset,
    navigationDriverScreenAnchor,
  ]);

  useEffect(() => {
    const unsubscribe = navigationObj.addListener('focus', () => {
      logger.info('[LiveMap] Tab focused, remounting map to refresh marker snapshots');
      setFocusKey((k) => k + 1);
    });
    return unsubscribe;
  }, [navigationObj]);

  // §9.1, P4, I6: LiveMap is controlled and presentational.
  // All camera logic removed — the controller owns camera behavior.

  // The camera controller owns all imperative camera behavior.

  // §13.1, P4a, I13: the passenger Ride screen must never synthesize a
  // straight-line route. No pickup→destination fallback is computed here.

  // Decode the passenger route polyline if present
  const decodedRouteCoords = React.useMemo(() => {
    if (!routePolyline) return null;
    try {
      const decoded = decodePolyline(routePolyline);
      if (decoded.length > 0) {
        return decoded.map((c) => ({
          latitude: c.lat,
          longitude: c.lng,
        }));
      }
    } catch (err) {
      logger.error('[LiveMap] Failed to decode routePolyline', { err, routePolyline });
    }
    return null;
  }, [routePolyline]);

  // Decode the driver route polyline if present.
  const decodedDriverRouteLatLng = React.useMemo(() => {
    if (!driverRoutePolyline) return null;
    try {
      const decoded = decodePolyline(driverRoutePolyline);
      if (decoded.length > 0) {
        return decoded;
      }
    } catch (err) {
      logger.error('[LiveMap] Failed to decode driverRoutePolyline', { err, driverRoutePolyline });
    }
    return null;
  }, [driverRoutePolyline]);

  const decodedDriverRouteCoords = React.useMemo(
    () =>
      decodedDriverRouteLatLng?.map((c) => ({
        latitude: c.lat,
        longitude: c.lng,
      })) ?? null,
    [decodedDriverRouteLatLng]
  );

  // Log mounting and props
  useEffect(() => {
    logger.info('[LiveMap] Component rendered / Props updated', {
      platform: Platform.OS,
      tripStatus: debugTripStatus,
      hasOwnLocation: !!ownLocation,
      ownLocation,
      hasDriverLocation: !!driverLocation,
      driverLocation,
      hasPickupLocation: !!pickupLocation,
      pickupLocation,
      hasDestinationLocation: !!destinationLocation,
      destinationLocation,
      showDestination,
      hasDriverRoutePolyline: !!driverRoutePolyline,
      showDriverRoute,
      decodedDriverRouteLength: decodedDriverRouteCoords?.length ?? 0,
      mountedDriverRoutePolylineLayers,
    });

    if (Platform.OS === 'web') {
      logger.warn('[LiveMap] Web platform detected. react-native-maps does not have native support on web. The map might render as a blank or transparent view.');
    }
  }, [
    debugTripStatus,
    ownLocation,
    driverLocation,
    pickupLocation,
    destinationLocation,
    showDestination,
    driverRoutePolyline,
    showDriverRoute,
    decodedDriverRouteCoords,
  ]);

  const driverRouteProgressLatitude = driverRouteProgressCoordinate?.latitude ?? null;
  const driverRouteProgressLongitude = driverRouteProgressCoordinate?.longitude ?? null;
  const driverRouteProgressLatLng = React.useMemo<LatLng | null>(
    () =>
      driverRouteProgressLatitude !== null && driverRouteProgressLongitude !== null
        ? {
          lat: driverRouteProgressLatitude,
          lng: driverRouteProgressLongitude,
        }
        : null,
    [driverRouteProgressLatitude, driverRouteProgressLongitude]
  );

  const trimmedDriverRoute = React.useMemo(() => {
    if (!decodedDriverRouteLatLng || !driverRouteProgressLatLng) {
      return null;
    }

    const split = splitPolylineAtClosestPoint(
      driverRouteProgressLatLng,
      decodedDriverRouteLatLng
    );

    return {
      consumed: split.consumed.map((c) => ({
        latitude: c.lat,
        longitude: c.lng,
      })),
      remaining: split.remaining.map((c) => ({
        latitude: c.lat,
        longitude: c.lng,
      })),
    };
  }, [decodedDriverRouteLatLng, driverRouteProgressLatLng]);

  const shouldShowDriverRouteLoading =
    showRouteStatus ||
    (showDriverRoute &&
      decodedDriverRouteCoords == null &&
      (driverLocation != null || ownLocation != null) &&
      (pickupLocation != null || destinationLocation != null));

  const renderedDriverRoutePolylineCount =
    Number(
      showDriverRoute &&
      trimmedDriverRoute != null &&
      trimmedDriverRoute.consumed.length >= 2,
    ) +
    Number(
      showDriverRoute &&
      trimmedDriverRoute != null &&
      trimmedDriverRoute.remaining.length >= 2,
    ) +
    Number(
      showDriverRoute &&
      trimmedDriverRoute == null &&
      decodedDriverRouteCoords != null,
    );

  useEffect(() => {
    logger.info('[LiveMap] driver-route polyline render state', {
      tripStatus: debugTripStatus,
      showDriverRoute,
      driverRoutePolyline,
      decodedDriverRouteLength: decodedDriverRouteCoords?.length ?? 0,
      renderedDriverRoutePolylineCount,
      hasTrimmedDriverRoute: trimmedDriverRoute != null,
      hasDecodedDriverRouteCoords: decodedDriverRouteCoords != null,
      mountedDriverRoutePolylineLayers,
    });
  }, [
    debugTripStatus,
    showDriverRoute,
    driverRoutePolyline,
    renderedDriverRoutePolylineCount,
    trimmedDriverRoute,
    decodedDriverRouteCoords,
  ]);

  // Driver navigation polyline styling depends on the leg the driver is on.
  // Pre-pickup (driver → pickup) is rendered in violet to distinguish it from
  // the rider-facing trip route. Once the trip is underway, the same live,
  // snapped navigation route is re-styled in the trip blue — callers suppress
  // the static booking polyline in this mode so the user sees a single route.
  const driverRouteRemainingColor =
    driverRouteVariant === 'trip' ? colors.blue.primary : colors.violet.primary;
  const driverRouteConsumedColor =
    driverRouteVariant === 'trip'
      ? 'rgba(47, 128, 237, 0.28)'
      : 'rgba(126, 87, 194, 0.28)';

  // Initial region only — the camera controller takes over once the map is ready.
  const initialRegion = React.useMemo(() => {
    if (pickupLocation && showDestination && destinationLocation) {
      const latitudeDelta = Math.max(
        Math.abs(pickupLocation.latitude - destinationLocation.latitude) * 1.6,
        0.015
      );
      const longitudeDelta = Math.max(
        Math.abs(pickupLocation.longitude - destinationLocation.longitude) * 1.6,
        0.015
      );

      return {
        latitude: (pickupLocation.latitude + destinationLocation.latitude) / 2,
        longitude: (pickupLocation.longitude + destinationLocation.longitude) / 2,
        latitudeDelta,
        longitudeDelta,
      };
    }

    const firstCoord =
      pickupLocation || driverLocation || ownLocation || (showDestination ? destinationLocation : null);
    return firstCoord
      ? {
        ...firstCoord,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }
      : ORMOC_CENTER;
  }, [pickupLocation, destinationLocation, showDestination, driverLocation, ownLocation]);

  const showConsumed = !!(showDriverRoute && trimmedDriverRoute && trimmedDriverRoute.consumed.length >= 2);
  const showRemaining = !!(showDriverRoute && trimmedDriverRoute && trimmedDriverRoute.remaining.length >= 2);
  const showFallback = !!(showDriverRoute && !trimmedDriverRoute && decodedDriverRouteCoords);

  return (
    <View
      style={[styles.container, style]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        logger.info('[LiveMap] Layout dimensions updated', { width, height });
        setContainerHeight(height);
      }}
    >
      <MapView
        key={`live-map-${focusKey}`}
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        mapPadding={navigationMapPadding}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        testID="live-map"
        onMapReady={() => {
          logger.info('[LiveMap] onMapReady callback triggered.');
          if (onMapReady) {
            onMapReady();
          }
        }}
        onMapLoaded={() => {
          logger.info('[LiveMap] onMapLoaded callback triggered.');
        }}
        onRegionChange={(_region, details) => {
          // Detect the gesture the moment it starts (continuous event) so the
          // camera controller releases its follow lock immediately. Waiting for
          // onRegionChangeComplete lets streaming GPS updates keep snapping the
          // camera back to the driver mid-gesture, fighting a pinch-zoom.
          if (details?.isGesture && onUserPan) {
            onUserPan();
          }
        }}
        onRegionChangeComplete={(region, details) => {
          logger.info('[LiveMap] onRegionChangeComplete triggered', {
            region,
            isGesture: details?.isGesture,
          });
          setLongitudeDelta(region.longitudeDelta);
          if (details?.isGesture && onUserPan) {
            onUserPan();
          }
          if (onRegionChangeComplete) {
            onRegionChangeComplete(region);
          }
        }}
      >
        {/* Passenger Route Polyline */}
        <Polyline
          key="passenger-route"
          coordinates={decodedRouteCoords ?? []}
          strokeWidth={decodedRouteCoords != null ? 4 : 0}
          strokeColor={decodedRouteCoords != null ? colors.blue.primary : 'transparent'}
        />

        {/* Driver Route Polyline (color is leg-dependent: pre-pickup = violet,
            in-trip = blue so the rider-facing trip route styling is reused
            for the live-snapped navigation route, with the booking polyline
            suppressed by the caller to avoid drawing the same line twice). */}
        <DriverRoutePolylineLayer
          key="driver-route-consumed"
          label="consumed"
          coordinates={showConsumed && trimmedDriverRoute ? trimmedDriverRoute.consumed : []}
          strokeWidth={showConsumed ? 4 : 0}
          strokeColor={showConsumed ? driverRouteConsumedColor : 'transparent'}
          debugTripStatus={debugTripStatus}
          debugShowDriverRoute={showDriverRoute}
          debugDriverRoutePolyline={driverRoutePolyline}
          debugDecodedDriverRouteLength={decodedDriverRouteCoords?.length ?? 0}
        />
        <DriverRoutePolylineLayer
          key="driver-route-remaining"
          label="remaining"
          coordinates={showRemaining && trimmedDriverRoute ? trimmedDriverRoute.remaining : []}
          strokeWidth={showRemaining ? 5 : 0}
          strokeColor={showRemaining ? driverRouteRemainingColor : 'transparent'}
          debugTripStatus={debugTripStatus}
          debugShowDriverRoute={showDriverRoute}
          debugDriverRoutePolyline={driverRoutePolyline}
          debugDecodedDriverRouteLength={decodedDriverRouteCoords?.length ?? 0}
        />
        <DriverRoutePolylineLayer
          key="driver-route-fallback"
          label="fallback"
          coordinates={showFallback && decodedDriverRouteCoords ? decodedDriverRouteCoords : []}
          strokeWidth={showFallback ? 4 : 0}
          strokeColor={showFallback ? driverRouteRemainingColor : 'transparent'}
          debugTripStatus={debugTripStatus}
          debugShowDriverRoute={showDriverRoute}
          debugDriverRoutePolyline={driverRoutePolyline}
          debugDecodedDriverRouteLength={decodedDriverRouteCoords?.length ?? 0}
        />

        {ownLocation && (
          <Marker
            key={`own-location-${showNavigationArrow ? arrowSize : 'dot'}`}
            coordinate={ownLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={showNavigationArrow ? navigationArrowRotation : undefined}
            testID="own-location-marker"
          >
            {showNavigationArrow ? (
              <View style={[styles.navigationArrow, { alignItems: 'center', justifyContent: 'center' }]}>
                <Image
                  source={require('../../../../assets/images/navigation_arrow.svg')}
                  style={{ width: arrowSize, height: arrowSize }}
                  contentFit="contain"
                />
              </View>
            ) : (
              <View style={[styles.markerRing, styles.ownLocationRing]}>
                <View style={[styles.markerDot, styles.ownLocationDot]} />
              </View>
            )}
          </Marker>
        )}

        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            testID="driver-location-marker"
          >
            <View style={[styles.markerRing, styles.driverRing, shadow.float]}>
              <View style={[styles.markerDot, styles.driverDot]} />
            </View>
          </Marker>
        )}

        {pickupLocation && (
          <Marker
            key={pickupKey != null ? `pickup-${pickupKey}-${!!onPickupDragEnd}` : 'pickup-default'}
            coordinate={pickupLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            title="Pickup"
            testID="pickup-marker"
            draggable={!!onPickupDragEnd}
            onDragEnd={(e) => {
              if (onPickupDragEnd) {
                onPickupDragEnd(e.nativeEvent.coordinate);
              }
            }}
          >
            <View style={[styles.markerRing, styles.pickupRing, shadow.card]}>
              <View style={[styles.markerDot, styles.pickupDot]} />
            </View>
          </Marker>
        )}

        {showDestination && destinationLocation && (
          <Marker
            key={destinationKey != null ? `destination-${destinationKey}-${!!onDestinationDragEnd}` : 'destination-default'}
            coordinate={destinationLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            title="Destination"
            testID="destination-marker"
            draggable={!!onDestinationDragEnd}
            onDragEnd={(e) => {
              if (onDestinationDragEnd) {
                onDestinationDragEnd(e.nativeEvent.coordinate);
              }
            }}
          >
            <View style={[styles.markerRing, styles.destinationRing, shadow.card]}>
              <View style={[styles.markerDot, styles.destinationDot]} />
            </View>
          </Marker>
        )}

        {/* Passenger Stop Waypoint Markers on Navigation Map */}
        {passengerStops.map((stop) => (
          <Marker
            key={`passenger-stop-${stop.id}-${stop.type}`}
            coordinate={stop.location}
            anchor={{ x: 0.5, y: 1.0 }}
            testID={`stop-marker-${stop.id}`}
          >
            <View style={styles.stopMarkerContainer}>
              <View style={styles.stopMarkerBubble}>
                <Text style={styles.stopMarkerText}>
                  {stop.type === 'pickup' ? 'Pickup: ' : 'Drop-off: '}{stop.passengerName}
                </Text>
              </View>
              <View
                style={[
                  styles.stopDotRing,
                  stop.type === 'pickup' ? styles.stopPickupRing : styles.stopDropoffRing,
                ]}
              >
                <View
                  style={[
                    styles.stopDotInner,
                    stop.type === 'pickup' ? styles.stopPickupDot : styles.stopDropoffDot,
                  ]}
                />
              </View>
            </View>
          </Marker>
        ))}
      </MapView>

      {shouldShowDriverRouteLoading && (
        <View pointerEvents="none" style={[styles.routeLoadingPill, shadow.float]}>
          <ActivityIndicator size="small" color={colors.violet.primary} />
          <Text style={styles.routeLoadingText}>{routeStatusLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  routeLoadingPill: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.surface.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  routeLoadingText: {
    color: colors.ink[700],
    fontSize: 13,
    fontWeight: '600',
  },
  markerRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // Own Location (Driver own position)
  ownLocationRing: {
    borderColor: 'rgba(47, 128, 237, 0.25)',
    backgroundColor: 'rgba(47, 128, 237, 0.15)',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  ownLocationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.blue.primary,
    borderWidth: 2,
    borderColor: colors.white,
  },
  navigationArrow: {
    width: 48,
    height: 48,
  },
  // Driver Marker (For passenger viewing)
  driverRing: {
    borderColor: colors.white,
    backgroundColor: colors.white,
    borderWidth: 2,
  },
  driverDot: {
    backgroundColor: colors.violet.primary,
  },
  // Pickup Marker (Green)
  pickupRing: {
    borderColor: colors.white,
    backgroundColor: colors.white,
    borderWidth: 2,
  },
  pickupDot: {
    backgroundColor: colors.blue.primary,
  },
  // Destination Marker (Orange)
  destinationRing: {
    borderColor: colors.white,
    backgroundColor: colors.white,
    borderWidth: 2,
  },
  destinationDot: {
    backgroundColor: colors.amber.primary,
  },
  // Passenger Stop Waypoint Markers
  stopMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopMarkerBubble: {
    backgroundColor: colors.ink[900],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  stopMarkerText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  stopDotRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  stopPickupRing: {
    borderColor: colors.blue.primary,
  },
  stopDropoffRing: {
    borderColor: colors.amber.primary,
  },
  stopDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stopPickupDot: {
    backgroundColor: colors.blue.primary,
  },
  stopDropoffDot: {
    backgroundColor: colors.amber.primary,
  },
});
