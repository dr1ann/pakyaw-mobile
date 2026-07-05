import { logger } from '@pakyaw/shared/lib/logger';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  InteractionManager,
  Platform,
} from 'react-native';
import MapView from 'react-native-maps';
import {
  NAV_ALTITUDE_M,
  NAV_CAMERA_ANIM_MS,
  NAV_PITCH,
  NAV_ZOOM,
} from '../navigation/constants';

// PiP state is driver-only; import dynamically if available
let useUiStore: any = null;
try {
  useUiStore = require('@/stores/uiStore').useUiStore;
} catch {
  // Not available in passenger branch
}

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
    animationDurationMs: number;
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
    animationDurationMs?: number;
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
  const cameraFollowing = useActiveTripStore((s) => s.cameraFollowing);
  const userPanned = !cameraFollowing;
  const queuedCommandRef = useRef<CameraCommand | null>(null);
  const lastExecutedCommandRef = useRef<string>('');
  const cameraCommandSequenceRef = useRef(0);
  const hasExecutedNavigationFollowRef = useRef(false);
  const prevNavEnabledRef = useRef(false);
  // Tracks the JS-side AppState. Camera mutations are gated on this being
  // 'active' so we never call into the native MapView while Android has torn
  // down the GL surface (Frustum == null in GoogleMap.getProjection() → NPE).
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

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
      // On the rising edge of Navigation Mode we want a real camera sweep
      // (Google-Maps-style tilt/zoom transition) rather than an instant snap,
      // even if the caller passed `animationDurationMs: 0` for its streaming
      // updates. Track the first *executed* navigation command rather than
      // only the enabled edge so a null coordinate or stale user-pan latch
      // cannot consume the engagement sweep before the map actually follows.
      const isEngagementFrame = !hasExecutedNavigationFollowRef.current;
      const requestedDuration = navigation.animationDurationMs ?? NAV_CAMERA_ANIM_MS;
      const durationMs = isEngagementFrame
        ? NAV_CAMERA_ANIM_MS
        : requestedDuration;
      return {
        type: 'navigationFollow',
        coordinate: navigation.coordinate,
        heading: navigation.heading,
        zoom: navigation.zoom ?? NAV_ZOOM,
        pitch: navigation.pitch ?? NAV_PITCH,
        altitude: navigation.altitude ?? NAV_ALTITUDE_M,
        animationDurationMs: durationMs,
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

    // Terminal phase: the navigation session has just ended (status flipped
    // to completed/cancelled). Snap back to an overview centered on the
    // driver's current navigation position (interpolated/snapped — the same
    // coordinate Navigation Mode was tracking) so the camera transition is
    // continuous with the rest of the navigation system. animateToRegion
    // implicitly restores pitch=0, heading=0, and overview zoom.
    if (phase === 'terminal') {
      if (driverLocation) {
        return { type: 'centerOn', coordinate: driverLocation };
      }
      if (ownLocation) {
        return { type: 'centerOn', coordinate: ownLocation };
      }
    }

    return null;
  };

  const logCameraCommand = (phase: 'before' | 'after', command: CameraCommand, sequence: number) => {
    logger.info(`[RideCameraController] camera.${phase}`, {
      sequence,
      timestampMs: Date.now(),
      isMapReady,
      cameraFollowing,
      userPanned,
      navigationEnabled: Boolean(navigation?.enabled),
      command,
    });
  };

  const logNextFrameCollision = (sequence: number, command: CameraCommand) => {
    const schedule =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0);
    schedule(() => {
      logger.info('[RideCameraController] camera.next_frame', {
        sequence,
        timestampMs: Date.now(),
        anotherCommandExecuted: cameraCommandSequenceRef.current !== sequence,
        latestSequence: cameraCommandSequenceRef.current,
        command,
      });
    });
  };

  const executeCommand = (command: CameraCommand) => {
    const map = mapRef.current;
    if (!map) {
      logger.info('[RideCameraController] Map not ready, queueing command:', command);
      queuedCommandRef.current = command;
      return;
    }

    // Gate every camera mutation behind a foreground AppState. Touching the
    // native map while the Activity is paused/stopped lets the camera-move
    // listener inside react-native-maps dereference a torn-down GL frustum
    // (java.lang.NullPointerException: Frustum is null at MapView.java:677).
    if (appStateRef.current !== 'active') {
      logger.info('[RideCameraController] App not active, queueing command:', command);
      queuedCommandRef.current = command;
      return;
    }

    const commandKey = JSON.stringify(command) + `_pad_${bottomPadding}`;
    if (commandKey === lastExecutedCommandRef.current) {
      return;
    }
    lastExecutedCommandRef.current = commandKey;

    const sequence = cameraCommandSequenceRef.current + 1;
    cameraCommandSequenceRef.current = sequence;
    logCameraCommand('before', command, sequence);
    logNextFrameCollision(sequence, command);

    logger.info('[RideCameraController] Executing command:', command);

    switch (command.type) {
      case 'fit': {
        if (command.coordinates.length === 0) return;
        if (command.coordinates.length === 1) {
          logger.info('[RideCameraController] camera.setCameraOrRegion', {
            method: 'animateToRegion',
            sequence,
            timestampMs: Date.now(),
            command,
          });
          map.animateToRegion(
            {
              ...command.coordinates[0],
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            },
            1000
          );
        } else {
          logger.info('[RideCameraController] camera.fitToCoordinates', {
            sequence,
            timestampMs: Date.now(),
            isMapReady,
            command,
          });
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
        logger.info('[RideCameraController] camera.setCameraOrRegion', {
          method: 'animateToRegion',
          sequence,
          timestampMs: Date.now(),
          command,
        });
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
        logger.info('[RideCameraController] camera.animateCamera', {
          sequence,
          timestampMs: Date.now(),
          isMapReady,
          command,
        });
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
        if (Platform.OS === 'android' && useUiStore && useUiStore.getState().pip.isInPip) {
          logger.info('[RideCameraController] Skipping navigation camera while PiP is active.');
          break;
        }

        const heading = normalizeHeading(command.heading);

        // The driver coordinate is passed directly as the camera target. The
        // off-center "driver near the bottom, road ahead" framing is achieved
        // via `mapPadding` on <MapView/>, not by projecting the target forward.
        // mapPadding shifts the camera anchor inside the viewport, so the same
        // geographic point lands lower on screen without needing to point the
        // camera ahead of the vehicle.
        logger.info('[RideCameraController] camera.animateCamera', {
          sequence,
          timestampMs: Date.now(),
          isMapReady,
          command,
        });
        map.animateCamera(
          {
            center: command.coordinate,
            heading,
            pitch: command.pitch,
            zoom: command.zoom,
            altitude: command.altitude,
          },
          { duration: command.animationDurationMs }
        );
        hasExecutedNavigationFollowRef.current = true;
        break;
      }
      case 'overview':
        break;
    }
  };

  // AppState listener — gate camera mutations on foreground, drain the queue
  // when we come back. Placed before the main camera effect so subsequent
  // dependency-driven runs see the up-to-date appStateRef.
  useEffect(() => {
    const drainQueue = () => {
      const command = queuedCommandRef.current;
      queuedCommandRef.current = null;
      lastExecutedCommandRef.current = '';
      if (command) {
        logger.info('[RideCameraController] Draining queued command after resume:', command);
        executeCommand(command);
      }
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      // Ignore transient 'inactive' (iOS Control Center, app switcher peek,
      // permission dialogs). Only real background/active transitions should
      // flip the gate.
      if (nextState === 'inactive') return;
      const previous = appStateRef.current;
      appStateRef.current = nextState;

      if (previous !== 'active' && nextState === 'active') {
        // Wait two animation frames so the GoogleMap GL surface has been
        // re-bound by react-native-maps' lifecycle observer (Activity
        // ON_RESUME → MapView.onResume → frustum recreated), then defer past
        // any in-flight interactions before touching the native map.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            InteractionManager.runAfterInteractions(drainQueue);
          });
        });
      }
    });

    return () => subscription.remove();
    // executeCommand is stable for our purposes (reads from refs/props through
    // closure); listing it would recreate the subscription on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-evaluate camera whenever inputs or userPanned state changes
  useEffect(() => {
    // Engaging Navigation Mode always re-centers on the driver, even if the
    // user had panned away while in overview. Clear the pan latch on the
    // rising edge so the follow camera isn't suppressed by a stale pan.
    const navEnabled = Boolean(navigation?.enabled);
    if (navEnabled && !prevNavEnabledRef.current) {
      useActiveTripStore.getState().setCameraFollowing(true);
      lastExecutedCommandRef.current = '';
      hasExecutedNavigationFollowRef.current = false;
    }
    // On the falling edge (nav has just ended — e.g. trip completed/cancelled
    // disarms Driving Mode) also clear the pan latch so the terminal-phase
    // camera command isn't suppressed by a stale pan from the in-trip phase.
    // Without this, panning during in_progress would freeze the camera in
    // place after Complete Trip until the driver tapped recenter.
    if (!navEnabled && prevNavEnabledRef.current && userPanned) {
      useActiveTripStore.getState().setCameraFollowing(true);
    }
    if (!navEnabled) {
      hasExecutedNavigationFollowRef.current = false;
    }

    // IMPORTANT: derive the command BEFORE updating prevNavEnabledRef so
    // getNextCommand's `isEngagementFrame = !prevNavEnabledRef.current` check
    // still sees the *previous* value on the rising edge. Overwriting the ref
    // first would collapse the engagement sweep to the caller's streaming
    // duration (which is 0 for the driver screen), causing the camera to
    // appear stuck — the driver would have to press Recenter to acquire focus.
    const command = getNextCommand({
      ignoreUserPanned: navEnabled && !hasExecutedNavigationFollowRef.current,
    });
    logger.info('[RideCameraController] navigation command snapshot', {
      timestampMs: Date.now(),
      isMapReady,
      tripPhase: phase,
      navigationEnabled: Boolean(navigation?.enabled),
      navigationCoordinate: navigation?.coordinate,
      heading: navigation?.heading,
      routeBearing: inputs.driverHeading ?? null,
      cameraFollowing,
      userPanned,
      lastExecutedCommandRef: lastExecutedCommandRef.current,
      command,
    });
    prevNavEnabledRef.current = navEnabled;
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
    navigation?.animationDurationMs,
    phase,
    userPanned,
    isMapReady,
    bottomPadding,
    overviewKey,
  ]);

  const handleMapReady = () => {
    logger.info('[RideCameraController] Map reported ready.');
    setIsMapReady(true);
    logger.info('[RideCameraController] camera.helper.map_ready', {
      timestampMs: Date.now(),
      cameraFollowing,
      userPanned,
      navigationEnabled: Boolean(navigation?.enabled),
      queuedCommand: queuedCommandRef.current,
    });
    const preserveManualNavigationPan = Boolean(navigation?.enabled && userPanned);
    if (!preserveManualNavigationPan) {
      useActiveTripStore.getState().setCameraFollowing(true);
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
    logger.info('[RideCameraController] camera.helper.user_pan', {
      timestampMs: Date.now(),
      cameraFollowing,
      navigationEnabled: Boolean(navigation?.enabled),
    });
    useActiveTripStore.getState().setCameraFollowing(false);
  };

  const recenter = () => {
    logger.info('[RideCameraController] Recentering camera.');
    logger.info('[RideCameraController] camera.helper.recenter', {
      timestampMs: Date.now(),
      cameraFollowing,
      userPanned,
      navigationEnabled: Boolean(navigation?.enabled),
    });
    useActiveTripStore.getState().setCameraFollowing(true);
    lastExecutedCommandRef.current = '';
    const command = getNextCommand({ ignoreUserPanned: true });
    if (command) {
      if (isMapReady) {
        executeCommand(command);
      } else {
        queuedCommandRef.current = command;
      }
    }
  };

  return {
    onMapReady: handleMapReady,
    onUserPan: handleUserPan,
    recenter,
    forceFollow: recenter,
    userPanned,
  };
}
