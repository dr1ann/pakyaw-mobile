/**
 * Location service — manages the foreground watchPositionAsync subscription
 * and throttled Firestore writes to drivers/{uid}.
 *
 * Architecture constraints (Phase 5):
 * - Background tracking uses the same drivers/{uid} write contract.
 * - Watch is started/stopped by useLocationPublisher (never directly by screens).
 * - Throttle: ~4–5 s elapsed OR ~25 m moved (lib/throttle.shouldEmit).
 * - Writes update: location, geohash, heading, locationUpdatedAt.
 *
 * The service exposes a singleton subscriber handle so it can be safely
 * stopped from multiple call sites without leaking subscriptions.
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, type FieldValue, serverTimestamp, updateDoc } from 'firebase/firestore';

import { LocationPermissionError } from '@/features/driver-availability/errors';
import type { DriverLocation } from '@pakyaw/shared/types/driver';
import type { LatLng } from '@pakyaw/shared/lib/geo';
import { geohashOf } from '@pakyaw/shared/lib/geo';
import { logger } from '@pakyaw/shared/lib/logger';
import { shouldEmit } from '@/lib/throttle';
import { firestore } from '@/services/firebase/firebase';

export const DRIVER_BACKGROUND_LOCATION_TASK = 'pakyaw-driver-background-location';
export const DRIVER_BACKGROUND_LOCATION_UID_KEY = 'pakyaw:driver-background-location-uid';
export const DRIVER_LAST_BACKGROUND_LOCATION_KEY = 'pakyaw:last-bg-location';

export type LastBackgroundLocation = {
  readonly latitude: number;
  readonly longitude: number;
  readonly heading: number | null;
  readonly speed: number | null;
  readonly recordedAt: number;
};

/** Throttle state — bound to each subscription instance. */
type ThrottleState = {
  lastAt: number | null;
  lastGeo: LatLng | null;
};

/** Payload type local to this service. */
type LocationPublishPayload = {
  location: DriverLocation;
  geohash: string;
  heading: number | null;
  locationUpdatedAt: FieldValue;
};

/** Mutable singleton subscription handle. */
let _subscription: Location.LocationSubscription | null = null;
let _currentAccuracy: Location.Accuracy | null = null;

export function getBackgroundLocationOptions(): Location.LocationTaskOptions {
  return {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 25,
    timeInterval: 10_000,
    deferredUpdatesDistance: 25,
    deferredUpdatesInterval: 10_000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Pakyaw driver location active',
      notificationBody: 'Sharing your location while you are online or on a trip.',
      notificationColor: '#208AEF',
    },
  };
}

/**
 * Request foreground location permission.
 * Throws LocationPermissionError if permission is denied.
 *
 * Checks the existing permission state first — only prompts the OS when needed.
 * On Android, an unconditional requestForegroundPermissionsAsync can trigger a
 * transparent permission Activity that briefly takes focus, causing AppState
 * background/foreground transitions even when permission is already granted.
 */
export async function ensureForegroundPermission(): Promise<void> {
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.status === 'granted') {
    return;
  }
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationPermissionError();
  }
}

export async function ensureBackgroundPermission(): Promise<void> {
  await ensureForegroundPermission();

  const existing = await Location.getBackgroundPermissionsAsync();
  if (existing.status === 'granted') {
    return;
  }

  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationPermissionError(
      'Background location permission is required to keep sharing driver location when Pakyaw is not open.',
    );
  }
}

export async function startBackgroundPublishing(uid: string): Promise<void> {
  await AsyncStorage.setItem(DRIVER_BACKGROUND_LOCATION_UID_KEY, uid);

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(
    DRIVER_BACKGROUND_LOCATION_TASK,
  );

  if (hasStarted) {
    return;
  }

  await ensureBackgroundPermission();
  await Location.startLocationUpdatesAsync(
    DRIVER_BACKGROUND_LOCATION_TASK,
    getBackgroundLocationOptions(),
  );
  logger.info('[location] background subscription started');
}

export async function stopBackgroundPublishing(): Promise<void> {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(
    DRIVER_BACKGROUND_LOCATION_TASK,
  );

  if (!hasStarted) {
    await AsyncStorage.removeItem(DRIVER_BACKGROUND_LOCATION_UID_KEY);
    return;
  }

  await Location.stopLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
  await AsyncStorage.removeItem(DRIVER_BACKGROUND_LOCATION_UID_KEY);
  logger.info('[location] background subscription stopped');
}

export function getLocationPublishPayload(
  locationObject: Location.LocationObject,
): LocationPublishPayload {
  const { latitude, longitude, heading } = locationObject.coords;

  return {
    location: { latitude, longitude },
    geohash: geohashOf({ lat: latitude, lng: longitude }, 7),
    heading: heading ?? null,
    locationUpdatedAt: serverTimestamp(),
  };
}

export async function publishDriverLocation(
  uid: string,
  locationObject: Location.LocationObject,
): Promise<void> {
  const driverRef = doc(firestore, 'drivers', uid);
  await updateDoc(driverRef, getLocationPublishPayload(locationObject));
}

/**
 * Start watching the device's foreground position and publishing throttled
 * updates to drivers/{uid}.
 *
 * Must only be called after ensureForegroundPermission() has resolved.
 * If a subscription is already active with the same accuracy, this is a no-op.
 * If active with a different accuracy, it restarts with the new accuracy.
 *
 * @param uid - Firebase Auth uid of the driver.
 * @param onLocation - Optional callback invoked on each location update (high frequency, un-throttled).
 * @param accuracy - Dynamic accuracy config (defaults to Balanced).
 */
export async function startPublishing(
  uid: string,
  onLocation?: (lat: number, lng: number, heading: number | null, speed: number | null) => void,
  accuracy: Location.Accuracy = Location.Accuracy.Balanced,
): Promise<void> {
  if (_subscription) {
    if (_currentAccuracy === accuracy) {
      logger.warn('[location] startPublishing called while already active with same accuracy — no-op');
      return;
    }
    logger.info('[location] startPublishing accuracy changed, restarting subscription', {
      old: _currentAccuracy,
      new: accuracy,
    });
    stopPublishing();
  }

  _currentAccuracy = accuracy;

  // Throttle state is scoped to this subscription instance.
  const throttleState: ThrottleState = { lastAt: null, lastGeo: null };

  _subscription = await Location.watchPositionAsync(
    {
      accuracy: accuracy,
      // OS-level hints to reduce callback frequency. Our own shouldEmit gate
      // is the authoritative throttle on top of these.
      distanceInterval: 10, // metres
      timeInterval: 2_000,  // ms
    },
    async (locationObject) => {
      const { latitude, longitude, heading, speed } = locationObject.coords;
      const now = Date.now();
      const geo: LatLng = { lat: latitude, lng: longitude };

      // Mirror to store at high frequency (un-throttled) so local UI/camera updates smoothly.
      onLocation?.(latitude, longitude, heading ?? null, speed ?? null);

      // Apply time + distance throttle gate for Firestore writes.
      if (
        !shouldEmit({
          lastAt: throttleState.lastAt,
          lastGeo: throttleState.lastGeo,
          now,
          geo,
        })
      ) {
        return;
      }

      // Commit throttle state BEFORE the async Firestore write so a slow
      // network round-trip can't allow a flood of concurrent writes.
      throttleState.lastAt = now;
      throttleState.lastGeo = geo;

      try {
        // updateDoc is safe here: the document is guaranteed to exist because
        // goOnline() (which uses setDoc+merge) must succeed before the
        // location subscription is started.
        await publishDriverLocation(uid, locationObject);
        logger.info('[location] published', { latitude, longitude });
      } catch (err) {
        // Non-fatal: log and keep the subscription alive.
        // The next throttled update will retry.
        logger.error('[location] publish write failed:', { error: err });
      }
    },
  );

  logger.info('[location] subscription started', { uid, accuracy });
}

/**
 * Stop the foreground location subscription.
 * Idempotent — safe to call when no subscription is active.
 */
export function stopPublishing(): void {
  if (!_subscription) {
    return;
  }
  _subscription.remove();
  _subscription = null;
  _currentAccuracy = null;
  logger.info('[location] subscription stopped');
}

/**
 * Returns true when a foreground subscription is currently active.
 */
export function isPublishing(): boolean {
  return _subscription !== null;
}
