import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/services/firebase/firebase';
import { getNavigationRoute } from '../services/routingService';
import { isNavActiveStatus } from '../navigation/navigationHelper';
import type { NavRoute } from '../navigation/types';
import { useActiveTripStore } from '@/stores/activeTripStore';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { haversineMeters } from '@/lib/geo';
import { getMinDistanceToPolyline } from '@/lib/geoProjection';
import { logger } from '@/lib/logger';
import {
  REROUTE_MIN_MOVE_M,
  REROUTE_MIN_INTERVAL_MS,
  OFF_ROUTE_M,
} from '../navigation/constants';

/**
 * Hook to fetch the driver navigation route (Phase 12 Navigation).
 * Parameterizes target: pickup coords during waiting, destination coords during trip.
 * Refetches on major driver movement, 25s elapsed, off-route detection (>50m), or phase change.
 * Publishes driverRoute to Firestore during the waiting phase (accepted/driver_arriving).
 */
export function useDriverRouteQuery(tripId: string | null) {
  const trip = useActiveTripStore((s) => s.trip);
  
  // Driver's own live location from availabilityStore
  const lastLatitude = useAvailabilityStore((s) => s.lastLatitude);
  const lastLongitude = useAvailabilityStore((s) => s.lastLongitude);

  const status = trip?.status ?? null;
  const pickupCoords = trip?.pickup?.coords ?? null;
  const destinationCoords = trip?.destination?.coords ?? null;

  // Determine target coordinates based on navigation phase
  const isToPickup = status === 'accepted' || status === 'driver_arriving';
  const isToDestination = status === 'in_progress';
  const targetCoords = isToPickup ? pickupCoords : isToDestination ? destinationCoords : null;

  const hasDriverCoords = lastLatitude !== null && lastLongitude !== null;
  const hasTargetCoords = targetCoords !== null;

  // Enabled only while status is accepted, driver_arriving, or in_progress
  const enabled =
    !!tripId &&
    hasDriverCoords &&
    hasTargetCoords &&
    isNavActiveStatus(status) &&
    status !== 'driver_arrived';

  const [queryCoords, setQueryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const lastPublishedRouteRef = useRef<{ polyline: string; distanceMeters: number; durationSeconds: number } | null>(null);
  const currentRouteRef = useRef<NavRoute | null>(null);
  const decodedRoutePointsRef = useRef<{ lat: number; lng: number }[]>([]);
  const isFirstMountRef = useRef<boolean>(true);

  // Reset tracking refs and coordinates inside useEffect when tripId changes (skip initial mount)
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    lastFetchTimeRef.current = 0;
    lastPublishedRouteRef.current = null;
    currentRouteRef.current = null;
    decodedRoutePointsRef.current = [];
    setQueryCoords(null);
  }, [tripId]);

  useEffect(() => {
    if (!enabled) {
      setTimeout(() => {
        setQueryCoords(null);
      }, 0);
      lastFetchTimeRef.current = 0;
      return;
    }

    const checkAndUpdate = () => {
      if (lastLatitude === null || lastLongitude === null) return;

      const now = Date.now();
      const currentLive = { lat: lastLatitude, lng: lastLongitude };

      if (!queryCoords) {
        logger.info('[useDriverRouteQuery] Initializing query coordinates', { currentLive });
        setQueryCoords(currentLive);
        lastFetchTimeRef.current = now;
        return;
      }

      // Check off-route trigger (immediate)
      if (currentRouteRef.current && currentRouteRef.current.overviewPolyline) {
        const decodedPoints = decodedRoutePointsRef.current;
        if (decodedPoints.length > 0) {
          const offRouteDist = getMinDistanceToPolyline(currentLive, decodedPoints);
          if (offRouteDist >= OFF_ROUTE_M) {
            logger.info('[useDriverRouteQuery] Off-route detected! Forcing immediate route refresh.', {
              offRouteDist,
              currentLive,
            });
            setQueryCoords(currentLive);
            lastFetchTimeRef.current = now;
            return;
          }
        }
      }

      // Check normal distance and time thresholds
      const distance = haversineMeters(queryCoords, currentLive);
      const timeElapsed = now - lastFetchTimeRef.current;

      if (distance >= REROUTE_MIN_MOVE_M || timeElapsed >= REROUTE_MIN_INTERVAL_MS) {
        logger.info('[useDriverRouteQuery] Threshold reached. Updating query coordinates for refetch.', {
          distance,
          timeElapsed,
          currentLive,
        });
        setQueryCoords(currentLive);
        lastFetchTimeRef.current = now;
      }
    };

    // Run check immediately when dependencies change
    checkAndUpdate();

    // Setup periodic check for time-based refetching (every 5 seconds)
    const interval = setInterval(checkAndUpdate, 5_000);
    return () => clearInterval(interval);
  }, [lastLatitude, lastLongitude, targetCoords, status, enabled, queryCoords]);

  const query = useQuery<NavRoute, Error>({
    queryKey: [
      'driverRoute',
      tripId,
      queryCoords?.lat,
      queryCoords?.lng,
      targetCoords?.lat,
      targetCoords?.lng,
    ],
    queryFn: async () => {
      if (!queryCoords || !targetCoords) {
        throw new Error('Required parameters missing for driver route.');
      }
      return getNavigationRoute(queryCoords, targetCoords);
    },
    enabled: enabled && queryCoords !== null,
    staleTime: 20_000,
    retry: 2,
  });

  // Keep currentRouteRef and decodedRoutePointsRef in sync with query data
  useEffect(() => {
    if (query.data) {
      currentRouteRef.current = query.data;
      decodedRoutePointsRef.current = query.data.steps.flatMap((s) => s.polyline);
    }
  }, [query.data]);

  // Publish to Firestore when to_pickup route is successfully updated
  useEffect(() => {
    if (!tripId || !query.data || !enabled || !isToPickup) return;

    const { overviewPolyline, distanceMeters, durationSeconds } = query.data;

    // Check if route changed significantly before writing to Firestore
    if (lastPublishedRouteRef.current !== null) {
      const prev = lastPublishedRouteRef.current;
      const polylineChanged = prev.polyline !== overviewPolyline;
      const distanceDiff = Math.abs(distanceMeters - prev.distanceMeters);
      const durationDiff = Math.abs(durationSeconds - prev.durationSeconds);

      // Throttling: only update if polyline changes, or distance changes > 50m, or duration > 15s
      if (!polylineChanged && distanceDiff <= 50 && durationDiff <= 15) {
        logger.info('[useDriverRouteQuery] Skipping Firestore write: change is below thresholds');
        return;
      }
    }

    logger.info('[useDriverRouteQuery] Publishing driverRoute update to Firestore', {
      tripId,
      distanceMeters,
      durationSeconds,
    });

    lastPublishedRouteRef.current = {
      polyline: overviewPolyline,
      distanceMeters,
      durationSeconds,
    };

    const tripRef = doc(firestore, 'trips', tripId);
    updateDoc(tripRef, {
      driverRoute: {
        polyline: overviewPolyline,
        distanceMeters,
        durationSeconds,
        updatedAt: serverTimestamp(),
      },
    }).catch((err) => {
      logger.error('[useDriverRouteQuery] Failed to publish driverRoute update', { err });
    });
  }, [query.data, tripId, enabled, isToPickup]);

  return {
    ...query,
    // Return null route if not enabled, ensuring the polyline disappears immediately on status change
    data: enabled ? query.data : undefined,
  };
}

