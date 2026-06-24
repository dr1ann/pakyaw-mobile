/**
 * Location service — manages the foreground watchPositionAsync subscription
 * and throttled Firestore writes to drivers/{uid}.
 *
 * Architecture constraints (Phase 5):
 * - Foreground ONLY. No TaskManager, no background permissions.
 * - Watch is started/stopped by useLocationPublisher (never directly by screens).
 * - Throttle: ~4–5 s elapsed OR ~25 m moved (lib/throttle.shouldEmit).
 * - Writes update: location, geohash, heading, locationUpdatedAt.
 *
 * The service exposes a singleton subscriber handle so it can be safely
 * stopped from multiple call sites without leaking subscriptions.
 */

import * as Location from 'expo-location';
import { doc, type FieldValue, serverTimestamp, updateDoc } from 'firebase/firestore';

import { LocationPermissionError } from '@/features/driver-availability/errors';
import type { DriverLocation } from '@/features/driver-availability/types';
import type { LatLng } from '@/lib/geo';
import { geohashOf } from '@/lib/geo';
import { logger } from '@/lib/logger';
import { shouldEmit } from '@/lib/throttle';
import { firestore } from '@/services/firebase/firebase';

/** How accurate we need the location for publishing. */
const LOCATION_ACCURACY = Location.Accuracy.Balanced;

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

/**
 * Request foreground location permission.
 * Throws LocationPermissionError if permission is denied.
 */
export async function ensureForegroundPermission(): Promise<void> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationPermissionError();
  }
}

/**
 * Start watching the device's foreground position and publishing throttled
 * updates to drivers/{uid}.
 *
 * Must only be called after ensureForegroundPermission() has resolved.
 * If a subscription is already active, this is a no-op (safe to call twice).
 *
 * @param uid - Firebase Auth uid of the driver.
 * @param onLocation - Optional callback invoked on each accepted location update
 *                     (used by useLocationPublisher to mirror coords to the store).
 */
export async function startPublishing(
  uid: string,
  onLocation?: (lat: number, lng: number) => void,
): Promise<void> {
  if (_subscription) {
    logger.warn('[location] startPublishing called while already active — no-op');
    return;
  }

  // Throttle state is scoped to this subscription instance.
  const throttleState: ThrottleState = { lastAt: null, lastGeo: null };

  _subscription = await Location.watchPositionAsync(
    {
      accuracy: LOCATION_ACCURACY,
      // OS-level hints to reduce callback frequency. Our own shouldEmit gate
      // is the authoritative throttle on top of these.
      distanceInterval: 10, // metres
      timeInterval: 2_000,  // ms
    },
    async (locationObject) => {
      const { latitude, longitude, heading } = locationObject.coords;
      const now = Date.now();
      const geo: LatLng = { lat: latitude, lng: longitude };

      // Apply time + distance throttle gate.
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

      // Mirror to store so the placeholder map can show current coords.
      onLocation?.(latitude, longitude);

      const payload: LocationPublishPayload = {
        location: { latitude, longitude },
        geohash: geohashOf(geo, 7),
        heading: heading ?? null,
        locationUpdatedAt: serverTimestamp(),
      };

      try {
        // updateDoc is safe here: the document is guaranteed to exist because
        // goOnline() (which uses setDoc+merge) must succeed before the
        // location subscription is started.
        const driverRef = doc(firestore, 'drivers', uid);
        await updateDoc(driverRef, payload);
        logger.info('[location] published:', latitude, longitude);
      } catch (err) {
        // Non-fatal: log and keep the subscription alive.
        // The next throttled update will retry.
        logger.error('[location] publish write failed:', err);
      }
    },
  );

  logger.info('[location] subscription started for:', uid);
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
  logger.info('[location] subscription stopped');
}

/**
 * Returns true when a foreground subscription is currently active.
 */
export function isPublishing(): boolean {
  return _subscription !== null;
}
