/**
 * useLocationPublisher — owns the foreground location subscription lifecycle.
 *
 * Starts watchPositionAsync when:
 *   - availability is 'online' or 'on_trip'
 *   - app is in the foreground
 *   - component is mounted
 *
 * Stops the subscription when:
 *   - availability becomes 'offline'
 *   - app enters background (AppState change)
 *   - component unmounts
 *
 * Permission denied → exposes locationPermissionDenied: true (first-class state).
 * No automatic retry on permission denial per architecture §10.7.
 *
 * This hook NEVER registers TaskManager tasks. Foreground only.
 */

import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { LocationPermissionError } from '@/features/driver-availability/errors';
import {
  ensureForegroundPermission,
  isPublishing,
  startPublishing,
  stopPublishing,
} from '@/features/driver-availability/services/location.service';
import { logger } from '@/lib/logger';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { useSessionStore } from '@/stores/sessionStore';

export type UseLocationPublisherResult = {
  /** True when location permission has been denied. Show settings CTA when true. */
  locationPermissionDenied: boolean;
};

export function useLocationPublisher(): UseLocationPublisherResult {
  const uid = useSessionStore((s) => s.uid);
  const availability = useAvailabilityStore((s) => s.availability);
  const setLastLocation = useAvailabilityStore((s) => s.setLastLocation);
  const setAvailability = useAvailabilityStore((s) => s.setAvailability);

  const [locationPermissionDenied, setLocationPermissionDenied] =
    useState(false);

  // Track whether the app is foregrounded. Stored as a ref to avoid causing
  // re-renders on AppState changes, and to be readable inside effects without
  // stale-closure issues.
  const isForegroundedRef = useRef(AppState.currentState === 'active');

  // ── AppState listener ──────────────────────────────────────────────────────
  // Handles app backgrounding/foregrounding independently of availability
  // changes. When backgrounded, we stop immediately. When restored, the
  // main effect re-evaluates via startIfNeeded() from the subscription effect.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const wasForegrounded = isForegroundedRef.current;
        isForegroundedRef.current = nextState === 'active';

        if (wasForegrounded && nextState !== 'active') {
          // App entered background — stop immediately.
          logger.info('[locationPublisher] app backgrounded — stopping');
          stopPublishing();
        } else if (!wasForegrounded && nextState === 'active') {
          // App returned to foreground — re-read current availability from
          // the store and restart publishing if the driver is still online.
          const currentAvailability = useAvailabilityStore.getState().availability;
          const currentUid = useSessionStore.getState().uid;

          if (
            currentUid &&
            (currentAvailability === 'online' || currentAvailability === 'on_trip')
          ) {
            logger.info('[locationPublisher] app foregrounded — restarting');
            void startIfNeeded(currentUid, setLastLocation, setAvailability, setLocationPermissionDenied);
          }
        }
      },
    );
    return () => subscription.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Main subscription lifecycle ────────────────────────────────────────────
  // Runs when availability or uid changes. Starts the subscription when the
  // driver is online and foregrounded; stops it otherwise.
  useEffect(() => {
    let cancelled = false;

    if (availability === 'online' || availability === 'on_trip') {
      if (!uid) return;
      if (!isForegroundedRef.current) return;

      void (async () => {
        await startIfNeeded(
          uid,
          setLastLocation,
          setAvailability,
          setLocationPermissionDenied,
          () => cancelled,
        );
      })();
    } else {
      // Driver went offline — stop immediately.
      stopPublishing();
    }

    return () => {
      cancelled = true;
      // Only stop the subscription on unmount, not on every re-render.
      // The availability branch above handles the offline→stop transition.
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, uid]);

  // Stop on unmount unconditionally.
  useEffect(() => {
    return () => {
      stopPublishing();
    };
  }, []);

  return { locationPermissionDenied };
}

// ── Extracted async helper ─────────────────────────────────────────────────
// Extracted so it can be called from both the AppState listener (foreground
// restore) and the main subscription effect.

async function startIfNeeded(
  uid: string,
  setLastLocation: (lat: number, lng: number) => void,
  setAvailability: (a: 'offline') => void,
  setLocationPermissionDenied: (denied: boolean) => void,
  isCancelled?: () => boolean,
): Promise<void> {
  if (isPublishing()) return;

  try {
    await ensureForegroundPermission();
    if (isCancelled?.()) return;

    setLocationPermissionDenied(false);
    await startPublishing(uid, setLastLocation);
  } catch (err) {
    if (isCancelled?.()) return;

    if (err instanceof LocationPermissionError) {
      logger.warn('[locationPublisher] permission denied');
      setLocationPermissionDenied(true);
      setAvailability('offline');
    } else {
      logger.error('[locationPublisher] unexpected error starting subscription:', err);
    }
  }
}
