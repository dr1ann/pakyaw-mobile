import { logger } from '@/lib/logger';
import { useEffect, useRef, useState } from 'react';
import MapView from 'react-native-maps';
import {
  NAV_ALTITUDE_M,
  NAV_CAMERA_ANIM_MS,
  NAV_PITCH,
  NAV_ZOOM,
} from '../navigation/constants';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type CameraCommand =
  | { type: 'fit'; coordinates: Coordinate[] }
  | { type: 'centerOn'; coordinate: Coordinate }
  | { type: 'follow'; coordinate: Coordinate; heading: number | null }
  | {
      type: 'navigationFollow';
      coordinate: Coordinate;
      heading: number | null;
      zoom: number;
      pitch: number;
      altitude: number;
    }
  | { type: 'overview' };

export type RideCameraInput = {
  pickupLocation: Coordinate | null;
  destinationLocation: Coordinate | null;
  driverLocation: Coordinate | null;
  ownLocation: Coordinate | null;
  phase: 'booking' | 'connecting' | 'active' | 'terminal';
  driverHeading?: number | null;
  bottomPadding?: number;
  // Explicit overview framing. When provided (and Navigation Mode is off and the
  // user hasn't panned), the camera fits exactly these coordinates instead of
  // the phase-derived defaults. Lets the caller frame a specific leg, e.g.
  // [driver, pickup] then [pickup, destination].
  overviewCoordinates?: Coordinate[] | null;
  navigation?: {
    enabled: boolean;
    coordinate: Coordinate | null;
    heading: number | null;
    zoom?: number;
    pitch?: number;
    altitude?: number;
  };
};

function normalizeHeading(heading: number | null): number {
  if (heading == null || Number.isNaN(heading)) {
    return 0;
  }
  return ((heading % 360) + 360) % 360;
}

export function useRideCameraController(
  mapRef: React.RefObject<MapView | null>,
  inputs: RideCameraInput
) {
  const [isMapReady, setIsMapReady] = useState(false);
  const [userPanned, setUserPanned] = useState(false);
  const queuedCommandRef = useRef<CameraCommand | null>(null);
  const lastExecutedCommandRef = useRef<string>('');
  const prevNavEnabledRef = useRef(false);

  const {
    pickupLocation,
    destinationLocation,
    driverLocation,
    ownLocation,
    phase,
    bottomPadding = 320,
    overviewCoordinates,
    navigation,
  } = inputs;

  // Serialized overview-coordinate key for the effect dependency array.
  const overviewKey = JSON.stringify(overviewCoordinates ?? null);

  // Determine the next camera command based on coordinates and phase
  const getNextCommand = ({ ignoreUserPanned = false } = {}): CameraCommand | null => {
    if (userPanned && !ignoreUserPanned) {
      return { type: 'overview' };
    }

    if (navigation?.enabled && navigation.coordinate) {
      return {
        type: 'navigationFollow',
        coordinate: navigation.coordinate,
        heading: navigation.heading,
        zoom: navigation.zoom ?? NAV_ZOOM,
        pitch: navigation.pitch ?? NAV_PITCH,
        altitude: navigation.altitude ?? NAV_ALTITUDE_M,
      };
    }

    // Caller-supplied overview framing takes precedence over phase defaults.
    if (overviewCoordinates && overviewCoordinates.length > 0) {
      if (overviewCoordinates.length === 1) {
        return { type: 'centerOn', coordinate: overviewCoordinates[0] };
      }
      return { type: 'fit', coordinates: overviewCoordinates };
    }

    if (phase === 'booking') {
      if (pickupLocation && destinationLocation) {
        return { type: 'fit', coordinates: [pickupLocation, destinationLocation] };
      }
      if (pickupLocation) {
        return { type: 'centerOn', coordinate: pickupLocation };
      }
      if (ownLocation) {
        return { type: 'centerOn', coordinate: ownLocation };
      }
    }

    if (phase === 'connecting') {
      if (pickupLocation && destinationLocation) {
        return { type: 'fit', coordinates: [pickupLocation, destinationLocation] };
      }
    }

    if (phase === 'active') {
      const targetEndpoint = destinationLocation || pickupLocation;
      if (driverLocation && targetEndpoint) {
        return { type: 'fit', coordinates: [driverLocation, targetEndpoint] };
      }
      if (driverLocation) {
        return { type: 'centerOn', coordinate: driverLocation };
      }
    }

    return null;
  };

  const executeCommand = (command: CameraCommand) => {
    const map = mapRef.current;
    if (!map) {
      logger.info('[RideCameraController] Map not ready, queueing command:', command);
      queuedCommandRef.current = command;
      return;
    }

    const commandKey = JSON.stringify(command) + `_pad_${bottomPadding}`;
    if (commandKey === lastExecutedCommandRef.current) {
      return;
    }
    lastExecutedCommandRef.current = commandKey;

    logger.info('[RideCameraController] Executing command:', command);

    switch (command.type) {
      case 'fit': {
        if (command.coordinates.length === 0) return;
        if (command.coordinates.length === 1) {
          map.animateToRegion(
            {
              ...command.coordinates[0],
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            },
            1000
          );
        } else {
          map.fitToCoordinates(command.coordinates, {
            edgePadding: {
              top: 120,
              right: 80,
              bottom: bottomPadding,
              left: 80,
            },
            animated: true,
          });
        }
        break;
      }
      case 'centerOn': {
        map.animateToRegion(
          {
            ...command.coordinate,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          },
          1000
        );
        break;
      }
      case 'follow': {
        map.animateCamera(
          {
            center: command.coordinate,
            heading: command.heading ?? 0,
            pitch: 0,
            zoom: 16,
          },
          { duration: 1000 }
        );
        break;
      }
      case 'navigationFollow': {
        const heading = normalizeHeading(command.heading);

        // The driver coordinate is passed directly as the camera target. The
        // off-center "driver near the bottom, road ahead" framing is achieved
        // via `mapPadding` on <MapView/>, not by projecting the target forward.
        // mapPadding shifts the camera anchor inside the viewport, so the same
        // geographic point lands lower on screen without needing to point the
        // camera ahead of the vehicle.
        map.animateCamera(
          {
            center: command.coordinate,
            heading,
            pitch: command.pitch,
            zoom: command.zoom,
            altitude: command.altitude,
          },
          { duration: NAV_CAMERA_ANIM_MS }
        );
        break;
      }
      case 'overview':
        break;
    }
  };

  // Re-evaluate camera whenever inputs or userPanned state changes
  useEffect(() => {
    // Engaging Navigation Mode always re-centers on the driver, even if the
    // user had panned away while in overview. Clear the pan latch on the
    // rising edge so the follow camera isn't suppressed by a stale pan.
    const navEnabled = Boolean(navigation?.enabled);
    if (navEnabled && !prevNavEnabledRef.current && userPanned) {
      setUserPanned(false);
    }
    prevNavEnabledRef.current = navEnabled;

    const command = getNextCommand();
    if (command) {
      if (isMapReady) {
        executeCommand(command);
      } else {
        queuedCommandRef.current = command;
      }
    }
    // Camera commands are keyed by primitive input values, not helper identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pickupLocation?.latitude,
    pickupLocation?.longitude,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
    driverLocation?.latitude,
    driverLocation?.longitude,
    ownLocation?.latitude,
    ownLocation?.longitude,
    navigation?.enabled,
    navigation?.coordinate?.latitude,
    navigation?.coordinate?.longitude,
    navigation?.heading,
    navigation?.zoom,
    navigation?.pitch,
    navigation?.altitude,
    phase,
    userPanned,
    isMapReady,
    bottomPadding,
    overviewKey,
  ]);

  const handleMapReady = () => {
    logger.info('[RideCameraController] Map reported ready.');
    setIsMapReady(true);
    const preserveManualNavigationPan = Boolean(navigation?.enabled && userPanned);
    if (!preserveManualNavigationPan) {
      setUserPanned(false);
    }
    const command =
      queuedCommandRef.current ??
      getNextCommand({ ignoreUserPanned: !preserveManualNavigationPan });
    queuedCommandRef.current = null;
    lastExecutedCommandRef.current = '';
    if (command) {
      executeCommand(command);
    }
  };

  const handleUserPan = () => {
    // onRegionChange fires continuously during a gesture; only react to the
    // first event so we don't spam logs/state updates for the same pan.
    if (userPanned) return;
    logger.info('[RideCameraController] User panned map. Switching to overview.');
    setUserPanned(true);
  };

  const recenter = () => {
    logger.info('[RideCameraController] Recentering camera.');
    setUserPanned(false);
    lastExecutedCommandRef.current = '';
  };

  return {
    onMapReady: handleMapReady,
    onUserPan: handleUserPan,
    recenter,
    userPanned,
  };
}
