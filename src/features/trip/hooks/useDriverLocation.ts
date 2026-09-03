/**
 * useDriverLocation — Phase 8C passenger-side driver location subscription.
 *
 * Subscribes to drivers/{driverId} via onSnapshot and mirrors the location
 * field into activeTripStore.driverLocation. Active only while the trip
 * status is in DRIVER_LOCATION_ACTIVE_STATUSES (driver_arriving, driver_arrived,
 * in_progress).
 *
 * Tears down on:
 *   - trip becomes null
 *   - trip.driverId becomes null
 *   - trip status leaves active set
 *   - component unmount
 *   - sign out (uid drops)
 *
 * No UI logic, no transitions, no side effects beyond updating store.
 */

import { doc, firestore, onSnapshot, FirebaseError } from '@/services/firebase/firebase';
import { useEffect, useRef } from 'react';

import { DRIVER_LOCATION_ACTIVE_STATUSES } from '@pakyaw/shared/features/trip/types';
import { logger } from '@pakyaw/shared/lib/logger';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

export function useDriverLocation(): void {
  const trip = useActiveTripStore((s) => s.trip);
  const uid = useSessionStore((s) => s.uid);

  const driverId = trip?.driverId ?? null;
  const status = trip?.status ?? null;
  const isActive =
    status != null && DRIVER_LOCATION_ACTIVE_STATUSES.includes(status);

  const cancelledRef = useRef(false);

  useEffect(() => {
    if (uid == null || driverId == null || !isActive) {
      useActiveTripStore.getState().clearDriverLocation();
      return;
    }

    cancelledRef.current = false;
    logger.info('[trip] subscribing to driver location', { driverId });

    const driverRef = doc(firestore, 'drivers', driverId);

    const unsubscribe = onSnapshot(
      driverRef,
      (snap) => {
        if (cancelledRef.current) return;

        if (!snap.exists()) {
          useActiveTripStore.getState().clearDriverLocation();
          return;
        }

        const data = snap.data();
        const location = data.location as
          | { latitude: number; longitude: number }
          | null
          | undefined;

        if (
          location != null &&
          typeof location.latitude === 'number' &&
          typeof location.longitude === 'number'
        ) {
          useActiveTripStore.getState().setDriverLocation({
            latitude: location.latitude,
            longitude: location.longitude,
          });
        } else {
          useActiveTripStore.getState().clearDriverLocation();
        }
      },
      (err) => {
        if (cancelledRef.current) return;
        const code = String((err as any)?.code || (err as any)?.name || '').toLowerCase();
        const message = String((err as any)?.message || '').toLowerCase();
        if (
          code.includes('permission') ||
          message.includes('permission') ||
          (err instanceof FirebaseError && err.code === 'permission-denied')
        ) {
          logger.info('[trip] driver location subscription ended (permission revoked or unavailable)', {
            driverId,
          });
          useActiveTripStore.getState().clearDriverLocation();
          return;
        }
        logger.error('[trip] driver location subscription error', {
          err,
          driverId,
        });
        useActiveTripStore.getState().clearDriverLocation();
      },
    );

    return () => {
      cancelledRef.current = true;
      unsubscribe();
      useActiveTripStore.getState().clearDriverLocation();
    };
  }, [uid, driverId, isActive]);
}
