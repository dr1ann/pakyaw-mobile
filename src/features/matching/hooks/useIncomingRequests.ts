/**
 * useIncomingRequests — Phase 7 driver matching subscription hook.
 *
 * Subscribes to nearby trip requests via subscribeIncoming only while the
 * driver is online and has a known location. Auto-unsubscribes when the
 * driver goes offline / on_trip, when the session uid drops, or when the
 * component using this hook unmounts.
 *
 * The hook never returns data — snapshots are piped into the availability
 * store via setIncomingRequests so any component can read them with a
 * selector. On teardown, clearIncomingRequests flushes the local mirror.
 */

import { useEffect } from 'react';

import { subscribeIncoming } from '@/features/matching/services/matching.service';
import { geohashOf } from '@/lib/geo';
import { logger } from '@/lib/logger';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { useSessionStore } from '@/stores/sessionStore';

const GEOHASH_PRECISION = 5;

export function useIncomingRequests(): void {
  const availability = useAvailabilityStore((s) => s.availability);
  const lastLatitude = useAvailabilityStore((s) => s.lastLatitude);
  const lastLongitude = useAvailabilityStore((s) => s.lastLongitude);
  const uid = useSessionStore((s) => s.uid);

  const prefix =
    lastLatitude != null && lastLongitude != null
      ? geohashOf({ lat: lastLatitude, lng: lastLongitude }, GEOHASH_PRECISION)
      : null;

  useEffect(() => {
    if (availability !== 'online' || uid == null || prefix == null) {
      return;
    }

    const { setIncomingRequests, clearIncomingRequests } =
      useAvailabilityStore.getState();

    const unsubscribe = subscribeIncoming(
      prefix,
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
  }, [availability, uid, prefix]);
}
