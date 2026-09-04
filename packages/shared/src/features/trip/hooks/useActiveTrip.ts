/**
 * useActiveTrip — Phase 8B active trip subscription hook.
 *
 * Subscribes to trips/{tripId} via trip.service.subscribe and pushes
 * snapshots into activeTripStore. Tears down on:
 *   - tripId becomes null (no active trip)
 *   - component unmount
 *   - sign out (uid drops)
 *
 * No router.push, no UI logic, no side effects beyond updating store.
 * Components read trip state from activeTripStore selectors.
 */

import { useEffect } from 'react';

import { subscribe } from '@pakyaw/shared/features/trip/services/trip.service';
import { logger } from '@pakyaw/shared/lib/logger';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

let activeTripId: string | null = null;
let activeUnsubscribe: (() => void) | null = null;
let subscriptionCount = 0;

export function useActiveTrip(): void {
  const tripId = useActiveTripStore((s) => s.tripId);
  const uid = useSessionStore((s) => s.uid);

  useEffect(() => {
    if (tripId == null || uid == null) {
      return;
    }

    if (activeTripId === tripId && activeUnsubscribe) {
      subscriptionCount++;
      logger.debug('[trip] reusing active trip subscription', { tripId, subscriptionCount });
    } else {
      if (activeUnsubscribe) {
        logger.warn('[trip] active trip changed, unsubscribing from old trip', { activeTripId, newTripId: tripId });
        activeUnsubscribe();
      }

      activeTripId = tripId;
      subscriptionCount = 1;
      logger.info('[trip] subscribing to active trip', { tripId });

      const { setTrip, clearTrip } = useActiveTripStore.getState();

      activeUnsubscribe = subscribe(
        tripId,
        (trip) => {
          if (trip) {
            const currentUid = useSessionStore.getState().uid;
            if (trip.driverId && currentUid && trip.driverId !== currentUid) {
              logger.warn('[trip] active trip assigned to different driver', {
                tripId,
                tripDriverId: trip.driverId,
                currentUid,
              });
              clearTrip();
              return;
            }
            setTrip(trip);
          } else {
            logger.warn('[trip] active trip document disappeared', { tripId });
            clearTrip();
          }
        },
        (err) => {
          logger.error('[trip] active trip subscription error', { err, tripId });
          clearTrip();
        },
      );
    }

    return () => {
      if (activeTripId === tripId) {
        subscriptionCount--;
        logger.debug('[trip] unsubscribing instance from active trip', { tripId, subscriptionCount });
        if (subscriptionCount <= 0) {
          logger.info('[trip] all instances unsubscribed, tearing down subscription', { tripId });
          if (activeUnsubscribe) {
            activeUnsubscribe();
            activeUnsubscribe = null;
          }
          activeTripId = null;
          subscriptionCount = 0;
        }
      }
    };
  }, [tripId, uid]);
}
