import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, Image, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { colors, shadow } from '@/constants/theme';
import { decodePolyline } from '@/lib/maps/decodePolyline';
import { logger } from '@/lib/logger';
import { NAV_ZOOM, NAV_PITCH, NAV_CAMERA_ANIM_MS } from '@/features/maps/navigation/constants';

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
  readonly bottomPadding?: number;
  readonly pickupKey?: string | number;
  readonly destinationKey?: string | number;
  readonly navigation?: {
    readonly mode: 'follow' | 'overview';
    readonly center: { latitude: number; longitude: number } | null;
    readonly heading: number | null;
    readonly zoom?: number;
    readonly pitch?: number;
  };
  readonly onUserPan?: () => void;
};

const ORMOC_CENTER = {
  latitude: 11.0050,
  longitude: 124.6075,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

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
  bottomPadding,
  onDestinationDragEnd,
  pickupKey,
  destinationKey,
  navigation,
  onUserPan,
}: LiveMapProps) {
  const mapRef = useRef<MapView>(null);

  // Log mounting and props
  useEffect(() => {
    logger.info('[LiveMap] Component rendered / Props updated', {
      platform: Platform.OS,
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
    });

    if (Platform.OS === 'web') {
      logger.warn('[LiveMap] Web platform detected. react-native-maps does not have native support on web. The map might render as a blank or transparent view.');
    }
  }, [ownLocation, driverLocation, pickupLocation, destinationLocation, showDestination, driverRoutePolyline, showDriverRoute]);

  // Collect all active coordinates to fit on the map
  const activeCoords = React.useMemo(() => {
    const coords: { latitude: number; longitude: number }[] = [];
    if (ownLocation) {
      coords.push(ownLocation);
    }
    if (driverLocation) {
      coords.push(driverLocation);
    }
    if (pickupLocation) {
      coords.push(pickupLocation);
    }
    if (showDestination && destinationLocation) {
      coords.push(destinationLocation);
    }
    return coords;
  }, [ownLocation, driverLocation, pickupLocation, destinationLocation, showDestination]);

  // Ref to hold the latest active coordinates to avoid triggering fitToCoordinates on every tick
  const activeCoordsRef = useRef(activeCoords);
  useEffect(() => {
    activeCoordsRef.current = activeCoords;
  }, [activeCoords]);

  // A stable signature representing the presence, count, and types of active markers.
  // fitToCoordinates is only run when the signature changes, meaning markers appear, disappear,
  // or the set of active marker types changes.
  const markersSignature = React.useMemo(() => {
    return [
      !!ownLocation,
      !!driverLocation,
      !!pickupLocation,
      !!(showDestination && destinationLocation),
    ].join(',');
  }, [ownLocation, driverLocation, pickupLocation, destinationLocation, showDestination]);

  // Adjust map region to fit all active markers
  useEffect(() => {
    if (navigation?.mode === 'follow') {
      logger.info('[LiveMap] Skipping camera adjust: follow camera is active');
      return;
    }

    if (activeCoordsRef.current.length === 0 || !mapRef.current) {
      logger.info('[LiveMap] Skipping camera adjust: no active coordinates or map ref is null', {
        activeCoordsCount: activeCoordsRef.current.length,
        hasMapRef: !!mapRef.current,
      });
      return;
    }

    // Use a small timeout to let the map layout and markers mount first
    const timer = setTimeout(() => {
      if (mapRef.current) {
        if (activeCoordsRef.current.length === 1) {
          logger.info('[LiveMap] Centering map on single coordinate', {
            coordinate: activeCoordsRef.current[0],
          });
          mapRef.current.animateToRegion(
            {
              ...activeCoordsRef.current[0],
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            },
            1000
          );
        } else {
          logger.info('[LiveMap] Fitting map to coordinates', {
            coordinates: activeCoordsRef.current,
          });
          mapRef.current.fitToCoordinates(activeCoordsRef.current, {
            edgePadding: {
              top: 120,
              right: 80,
              bottom: bottomPadding ?? 320, // generous bottom padding to keep markers above bottom sheets
              left: 80,
            },
            animated: true,
          });
        }
      } else {
        logger.warn('[LiveMap] Camera adjust failed: mapRef.current is null after timeout');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [markersSignature, bottomPadding, navigation?.mode]);

  // Ephemeral Camera Follow in Navigation Mode
  useEffect(() => {
    if (
      !mapRef.current ||
      !navigation ||
      navigation.mode !== 'follow' ||
      !navigation.center
    ) {
      return;
    }

    const { center, heading, zoom = NAV_ZOOM, pitch = NAV_PITCH } = navigation;

    logger.info('[LiveMap] Animating camera to follow driver', {
      center,
      heading,
      zoom,
      pitch,
    });

    mapRef.current.animateCamera(
      {
        center,
        heading: heading ?? 0,
        pitch,
        zoom,
      },
      { duration: NAV_CAMERA_ANIM_MS }
    );
  }, [
    navigation?.mode,
    navigation?.center?.latitude,
    navigation?.center?.longitude,
    navigation?.heading,
    navigation?.zoom,
    navigation?.pitch,
  ]);

  // Fallback straight-line coordinates for passenger (pickup -> destination)
  const passengerFallbackCoords = React.useMemo(() => {
    if (pickupLocation && destinationLocation) {
      return [pickupLocation, destinationLocation];
    }
    return [];
  }, [pickupLocation, destinationLocation]);

  // Fallback straight-line coordinates for driver (driver -> pickup)
  const driverFallbackCoords = React.useMemo(() => {
    const driverPos = driverLocation || ownLocation;
    if (driverPos && pickupLocation) {
      return [driverPos, pickupLocation];
    }
    return [];
  }, [driverLocation, ownLocation, pickupLocation]);

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

  // Decode the driver route polyline if present
  const decodedDriverRouteCoords = React.useMemo(() => {
    if (!driverRoutePolyline) return null;
    try {
      const decoded = decodePolyline(driverRoutePolyline);
      if (decoded.length > 0) {
        return decoded.map((c) => ({
          latitude: c.lat,
          longitude: c.lng,
        }));
      }
    } catch (err) {
      logger.error('[LiveMap] Failed to decode driverRoutePolyline', { err, driverRoutePolyline });
    }
    return null;
  }, [driverRoutePolyline]);

  const initialRegion = activeCoords.length > 0
    ? {
        ...activeCoords[0],
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }
    : ORMOC_CENTER;

  return (
    <View
      style={[styles.container, style]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        logger.info('[LiveMap] Layout dimensions updated', { width, height });
      }}
    >
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        testID="live-map"
        onMapReady={() => {
          logger.info('[LiveMap] onMapReady callback triggered.');
        }}
        onMapLoaded={() => {
          logger.info('[LiveMap] onMapLoaded callback triggered.');
        }}
        onRegionChangeComplete={(region, details) => {
          logger.info('[LiveMap] onRegionChangeComplete triggered', {
            region,
            isGesture: details?.isGesture,
          });
          if (details?.isGesture && onUserPan) {
            onUserPan();
          }
        }}
      >
        {/* Passenger Route Polyline */}
        {decodedRouteCoords != null ? (
          <Polyline
            coordinates={decodedRouteCoords}
            strokeWidth={4}
            strokeColor={colors.blue.primary}
            lineDashPattern={[0]}
          />
        ) : (
          showDestination && passengerFallbackCoords.length > 1 && (
            <Polyline
              coordinates={passengerFallbackCoords}
              strokeWidth={4}
              strokeColor={colors.blue.primary}
              lineDashPattern={[6, 6]}
            />
          )
        )}

        {/* Driver Route Polyline */}
        {showDriverRoute && (decodedDriverRouteCoords != null ? (
          <Polyline
            coordinates={decodedDriverRouteCoords}
            strokeWidth={4}
            strokeColor={colors.violet.primary}
            lineDashPattern={[0]}
          />
        ) : (
          driverFallbackCoords.length > 1 && (
            <Polyline
              coordinates={driverFallbackCoords}
              strokeWidth={4}
              strokeColor={colors.violet.primary}
              lineDashPattern={[6, 6]}
            />
          )
        ))}

        {ownLocation && (
          <Marker
            coordinate={ownLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            testID="own-location-marker"
            rotation={navigation ? (navigation.heading ?? 0) : undefined}
          >
            {navigation ? (
              <Image
                source={require('../../../../assets/images/navigation_arrow.png')}
                style={styles.navigationArrow}
                resizeMode="contain"
              />
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
      </MapView>
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
    backgroundColor: colors.green.primary,
  },
  // Destination Marker (Red)
  destinationRing: {
    borderColor: colors.white,
    backgroundColor: colors.white,
    borderWidth: 2,
  },
  destinationDot: {
    backgroundColor: colors.danger,
  },
});
