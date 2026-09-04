/**
 * useActiveTrip — Phase 8B active trip subscription hook.
 *
 * Subscribes to trips/{tripId} via trip.service.subscribe and pushes
 * snapshots into activeTripStore. Tears down on:
 *   - tripId becomes null (no active trip)
 *   - component unmount (listener only; the persisted trip handoff remains)
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
let activeTripOwnerId: string | null = null;

function retainTerminalSnapshot(tripId: string, source: 'missing' | 'error'): boolean {
  const trip = useActiveTripStore.getState().trip;
  const isTerminal = trip?.status === 'completed' || trip?.status === 'cancelled';
  if (trip?.id === tripId && isTerminal) {
    logger.warn('[trip] retaining terminal trip snapshot until passenger dismissal', { tripId, source });
    return true;
  }
  return false;
}

export function useActiveTrip(): void {
  const tripId = useActiveTripStore((s) => s.tripId);
  const uid = useSessionStore((s) => s.uid);

  useEffect(() => {
    // A completed snapshot may stay in memory while the Passenger changes
    // tabs, but it must never survive an actual account change. Do not clear
    // during cold-start session hydration (there is no known prior owner yet).
    if (uid == null || (activeTripOwnerId != null && activeTripOwnerId !== uid)) {
      if (activeTripOwnerId != null) {
        logger.info('[trip] clearing active trip after account change', { activeTripId });
        activeTripOwnerId = null;
        useActiveTripStore.getState().clearTrip();
      }
      return;
    }

    if (tripId == null) {
      activeTripOwnerId = null;
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
      activeTripOwnerId = uid;
      subscriptionCount = 1;
      logger.info('[trip] subscribing to active trip', { tripId });

      const { setTrip, clearTrip } = useActiveTripStore.getState();

      activeUnsubscribe = subscribe(
        tripId,
        (trip) => {
          if (trip) {
            setTrip(trip);
          } else {
            logger.warn('[trip] active trip document disappeared', { tripId });
            if (!retainTerminalSnapshot(tripId, 'missing')) {
              clearTrip();
            }
          }
        },
        (err) => {
          logger.error('[trip] active trip subscription error', { err, tripId });
          if (!retainTerminalSnapshot(tripId, 'error')) {
            clearTrip();
          }
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
          // Do not clear the persisted trip here. Tabs can unmount the Ride
          // screen while a trip is active, and a completed trip must survive
          // until the Passenger explicitly dismisses its handoff.
        }
      }
    };
  }, [tripId, uid]);
}
