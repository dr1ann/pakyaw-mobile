import { logger } from '@/lib/logger';
import { useEffect, useRef, useState } from 'react';
import MapView from 'react-native-maps';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type CameraCommand =
  | { type: 'fit'; coordinates: Coordinate[] }
  | { type: 'centerOn'; coordinate: Coordinate }
  | { type: 'follow'; coordinate: Coordinate; heading: number | null }
  | { type: 'overview' };

export type RideCameraInput = {
  pickupLocation: Coordinate | null;
  destinationLocation: Coordinate | null;
  driverLocation: Coordinate | null;
  ownLocation: Coordinate | null;
  phase: 'booking' | 'connecting' | 'active' | 'terminal';
  driverHeading?: number | null;
  bottomPadding?: number;
};

export function useRideCameraController(
  mapRef: React.RefObject<MapView | null>,
  inputs: RideCameraInput
) {
  const [isMapReady, setIsMapReady] = useState(false);
  const [userPanned, setUserPanned] = useState(false);
  const queuedCommandRef = useRef<CameraCommand | null>(null);
  const lastExecutedCommandRef = useRef<string>('');

  const {
    pickupLocation,
    destinationLocation,
    driverLocation,
    ownLocation,
    phase,
    bottomPadding = 320,
  } = inputs;

  // Determine the next camera command based on coordinates and phase
  const getNextCommand = ({ ignoreUserPanned = false } = {}): CameraCommand | null => {
    if (userPanned && !ignoreUserPanned) {
      return { type: 'overview' };
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
      case 'overview':
        break;
    }
  };

  // Re-evaluate camera whenever inputs or userPanned state changes
  useEffect(() => {
    const command = getNextCommand();
    if (command) {
      if (isMapReady) {
        executeCommand(command);
      } else {
        queuedCommandRef.current = command;
      }
    }
  }, [
    pickupLocation?.latitude,
    pickupLocation?.longitude,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
    driverLocation?.latitude,
    driverLocation?.longitude,
    ownLocation?.latitude,
    ownLocation?.longitude,
    phase,
    userPanned,
    isMapReady,
    bottomPadding,
  ]);

  const handleMapReady = () => {
    logger.info('[RideCameraController] Map reported ready.');
    setIsMapReady(true);
    setUserPanned(false);
    const command = queuedCommandRef.current ?? getNextCommand({ ignoreUserPanned: true });
    queuedCommandRef.current = null;
    lastExecutedCommandRef.current = '';
    if (command) {
      executeCommand(command);
    }
  };

  const handleUserPan = () => {
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
