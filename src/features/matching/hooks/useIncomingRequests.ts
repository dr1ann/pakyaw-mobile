/**
 * useIncomingRequests — Phase 7 driver matching subscription hook.
 *
 * Subscribes to server-created trip offers only while the driver is online.
 * It auto-unsubscribes when the
 * driver goes offline / on_trip, when the session uid drops, or when the
 * component using this hook unmounts.
 *
 * The hook never returns data — snapshots are piped into the availability
 * store via setIncomingRequests so any component can read them with a
 * selector. On teardown, clearIncomingRequests flushes the local mirror.
 */

import { useEffect } from 'react';

import { subscribeDriverOffers } from '@/features/matching/services/matching.service';
import { logger } from '@pakyaw/shared/lib/logger';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

export function useIncomingRequests(): void {
  const availability = useAvailabilityStore((s) => s.availability);
  const uid = useSessionStore((s) => s.uid);

  useEffect(() => {
    if (availability !== 'online' || uid == null) {
      return;
    }

    const { setIncomingRequests, clearIncomingRequests } =
      useAvailabilityStore.getState();

    const unsubscribe = subscribeDriverOffers(
      uid,
      (requests) => {
        setIncomingRequests(requests);
      },
      (err) => {
        logger.error('[matching] incoming subscription error', { err });
        clearIncomingRequests();
      },
    );

    return () => {
      unsubscribe();
      useAvailabilityStore.getState().clearIncomingRequests();
    };
  }, [availability, uid]);
}
