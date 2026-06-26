import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/services/firebase/firebase';
import { getDriverToPickup } from '../services/distanceMatrixService';
import { useActiveTripStore } from '@/stores/activeTripStore';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { logger } from '@/lib/logger';

/**
 * Hook for drivers to poll and publish Distance Matrix updates to Firestore every 30 seconds (Phase 12).
 */
export function useDriverToPickupETA(tripId: string | null) {
  const trip = useActiveTripStore((s) => s.trip);
  
  // Driver's own live location from availabilityStore
  const lastLatitude = useAvailabilityStore((s) => s.lastLatitude);
  const lastLongitude = useAvailabilityStore((s) => s.lastLongitude);

  const lastWrittenRef = useRef<{ distanceMeters: number; etaSeconds: number } | null>(null);

  // Reset tracking ref when tripId changes
  useEffect(() => {
    lastWrittenRef.current = null;
  }, [tripId]);

  const status = trip?.status ?? null;
  const pickupCoords = trip?.pickup?.coords ?? null;

  const hasDriverCoords = lastLatitude !== null && lastLongitude !== null;
  const hasPickupCoords = pickupCoords !== null;

  // Enabled only while status is 'accepted' or 'driver_arriving'
  const enabled =
    !!tripId &&
    hasDriverCoords &&
    hasPickupCoords &&
    (status === 'accepted' || status === 'driver_arriving');

  const query = useQuery({
    queryKey: ['driverToPickupETA', tripId, lastLatitude, lastLongitude, pickupCoords],
    queryFn: async () => {
      if (!tripId || lastLatitude === null || lastLongitude === null || !pickupCoords) {
        throw new Error('Required parameters missing for Distance Matrix.');
      }
      
      const result = await getDriverToPickup(
        { latitude: lastLatitude, longitude: lastLongitude },
        pickupCoords
      );
      
      if (!result) {
        throw new Error('Distance Matrix call returned null.');
      }
      
      return result;
    },
    enabled,
    refetchInterval: 30_000, // Poll every 30 seconds
    staleTime: 25_000,
  });

  // Write to Firestore when new distance/ETA data is fetched
  useEffect(() => {
    if (!tripId || !query.data || !enabled) return;

    const { distanceMeters, etaSeconds } = query.data;

    // Throttle writes: check if change is significant (>50m or >15s)
    if (lastWrittenRef.current !== null) {
      const prev = lastWrittenRef.current;
      const distanceDiff = Math.abs(distanceMeters - prev.distanceMeters);
      const etaDiff = Math.abs(etaSeconds - prev.etaSeconds);

      if (distanceDiff <= 50 && etaDiff <= 15) {
        logger.info('[useDriverToPickupETA] Skipping Firestore write: change is below thresholds', {
          distanceDiff,
          etaDiff,
        });
        return;
      }
    }

    logger.info('[useDriverToPickupETA] Publishing driverToPickup update to Firestore', {
      tripId,
      distanceMeters,
      etaSeconds,
    });

    lastWrittenRef.current = { distanceMeters, etaSeconds };
    const tripRef = doc(firestore, 'trips', tripId);
    
    updateDoc(tripRef, {
      driverToPickup: {
        distanceMeters,
        etaSeconds,
        updatedAt: serverTimestamp(),
      },
    }).catch((err) => {
      logger.error('[useDriverToPickupETA] Failed to publish driverToPickup update', { err });
    });
  }, [query.data, tripId, enabled]);

  return query;
}
