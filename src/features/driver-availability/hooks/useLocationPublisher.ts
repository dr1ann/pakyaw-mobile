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
 * TaskManager registration lives in a top-level module; this hook starts/stops it.
 */

import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';

import * as Pip from '../../../../modules/expo-pip/src/ExpoPipModule';
import { LocationPermissionError } from '@/features/driver-availability/errors';
import {
  ensureForegroundPermission,
  isPublishing,
  startBackgroundPublishing,
  startPublishing,
  stopBackgroundPublishing,
  stopPublishing,
} from '@/features/driver-availability/services/location.service';
import { logger } from '@pakyaw/shared/lib/logger';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { useUiStore } from '@/stores/uiStore';

export type UseLocationPublisherResult = {
  /** True when location permission has been denied. Show settings CTA when true. */
  locationPermissionDenied: boolean;
};

export function useLocationPublisher(): UseLocationPublisherResult {
  const uid = useSessionStore((s) => s.uid);
  const availability = useAvailabilityStore((s) => s.availability);
  const setLastLocation = useAvailabilityStore((s) => s.setLastLocation);
  const setAvailability = useAvailabilityStore((s) => s.setAvailability);
  const trip = useActiveTripStore((s) => s.trip);
  const status = trip?.status ?? null;

  const [locationPermissionDenied, setLocationPermissionDenied] =
    useState(false);

  // Track whether the app is foregrounded. Stored as a ref to avoid causing
  // re-renders on AppState changes, and to be readable inside effects without
  // stale-closure issues.
  const isForegroundedRef = useRef(AppState.currentState === 'active');

  // Determine accuracy based on trip status
  const isNavActive = status !== null && ['accepted', 'driver_arriving', 'driver_arrived', 'in_progress'].includes(status);
  const accuracy = isNavActive ? Location.Accuracy.BestForNavigation : Location.Accuracy.Balanced;

  // ── AppState listener ──────────────────────────────────────────────────────
  // Handles app backgrounding/foregrounding independently of availability
  // changes. When backgrounded, we stop immediately. When restored, the
  // main effect re-evaluates via startIfNeeded() from the subscription effect.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        // Ignore transient 'inactive' state (iOS Control Center, app switcher
        // peek, permission dialogs, screen recording). Only a real 'background'
        // transition should tear down the location subscription.
        if (nextState === 'inactive') return;

        const wasForegrounded = isForegroundedRef.current;
        isForegroundedRef.current = nextState === 'active';

        if (wasForegrounded && nextState === 'background') {
          const pipIsActive =
            Platform.OS === 'android' &&
            (useUiStore.getState().pip.isInPip || Pip.isActive());
          if (pipIsActive) {
            logger.info('[locationPublisher] app in PiP — keeping foreground watch');
            return;
          }

          // App entered background — stop immediately.
          logger.info('[locationPublisher] app backgrounded — stopping');
          stopPublishing();
        } else if (!wasForegrounded && nextState === 'active') {
          // App returned to foreground — re-read current availability from
          // the store and restart publishing if the driver is still online.
          const currentAvailability = useAvailabilityStore.getState().availability;
          const currentUid = useSessionStore.getState().uid;
          const activeTrip = useActiveTripStore.getState().trip;
          const activeStatus = activeTrip?.status ?? null;
          const activeNav = activeStatus !== null && ['accepted', 'driver_arriving', 'driver_arrived', 'in_progress'].includes(activeStatus);
          const currentAccuracy = activeNav ? Location.Accuracy.BestForNavigation : Location.Accuracy.Balanced;

          if (
            currentUid &&
            (currentAvailability === 'online' || currentAvailability === 'on_trip')
          ) {
            logger.info('[locationPublisher] app foregrounded — restarting');
            void startIfNeeded(currentUid, setLastLocation, setAvailability, setLocationPermissionDenied, currentAccuracy);
          }
        }
      },
    );
    return () => subscription.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Main subscription lifecycle ────────────────────────────────────────────
  // Runs when availability or uid or status (accuracy) changes. Starts the subscription when the
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
          accuracy,
          () => cancelled,
        );
      })();
    } else {
      // Driver went offline — stop immediately.
      stopPublishing();
      void stopBackgroundPublishing().catch((err) => {
        logger.warn('[locationPublisher] failed to stop background tracking', {
          error: String(err),
        });
      });
    }

    return () => {
      cancelled = true;
      // Only stop the subscription on unmount, not on every re-render.
      // The availability branch above handles the offline→stop transition.
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, uid, status]);

  // Stop on unmount unconditionally.
  useEffect(() => {
    return () => {
      stopPublishing();
      void stopBackgroundPublishing().catch((err) => {
        logger.warn('[locationPublisher] failed to stop background tracking on unmount', {
          error: String(err),
        });
      });
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
  accuracy: Location.Accuracy,
  isCancelled?: () => boolean,
): Promise<void> {
  // When already publishing, skip the permission re-check. Permission was
  // verified at the original start. Re-checking on every effect re-run can
  // flap AppState on Android because the system permission API briefly takes
  // focus. startPublishing's own accuracy guard handles same-accuracy no-op
  // and accuracy-change restart.
  const alreadyPublishing = isPublishing();

  try {
    if (!alreadyPublishing) {
      await ensureForegroundPermission();
      if (isCancelled?.()) return;
      setLocationPermissionDenied(false);
    }

    void startBackgroundPublishing(uid).catch((err) => {
      logger.warn('[locationPublisher] background tracking unavailable', {
        error: String(err),
      });
    });

    await startPublishing(uid, (lat, lng, heading, speed) => {
      setLastLocation(lat, lng);

      // Pipe GPS course/speed coordinates to activeTripStore if navigation is active
      const activeTripState = useActiveTripStore.getState();
      const status = activeTripState.trip?.status ?? null;
      const isNavActive = status !== null && ['accepted', 'driver_arriving', 'driver_arrived', 'in_progress'].includes(status);
      if (isNavActive) {
        activeTripState.setGpsLocation(lat, lng, heading, speed);
      } else {
        activeTripState.setGpsLocation(lat, lng, null, null);
      }
    }, accuracy);
  } catch (err) {
    if (isCancelled?.()) return;

    if (err instanceof LocationPermissionError) {
      logger.warn('[locationPublisher] permission denied');
      setLocationPermissionDenied(true);
      setAvailability('offline');
    } else {
      logger.error('[locationPublisher] unexpected error starting subscription', { error: String(err) });
    }
  }
}
