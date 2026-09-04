import { haversineMeters } from '@pakyaw/shared/lib/geo';
import { projectPointOnSegment } from '@pakyaw/shared/lib/geoProjection';
import { logger } from '@pakyaw/shared/lib/logger';
import { doc, firestore, serverTimestamp, updateDoc } from '@/services/firebase/firebase';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  HEADING_MISMATCH_DEG,
  HEADING_SPEED_THRESHOLD_MS,
  OFF_ROUTE_CONFIRMATION_COUNT,
  OFF_ROUTE_M,
  POSITION_HISTORY_MAX_AGE_MS,
  POSITION_HISTORY_MIN_MOVE_M,
} from '@pakyaw/shared/features/maps/navigation/constants';
import { isNavActiveStatus } from '@pakyaw/shared/features/maps/navigation/navigationHelper';
import type { NavRoute } from '@pakyaw/shared/features/maps/navigation/types';
import { getNavigationRoute } from '@pakyaw/shared/features/maps/services/routingService';

type LatLng = { lat: number; lng: number };

function normalizeHeadingDegrees(heading: number): number {
  return ((heading % 360) + 360) % 360;
}

export function getHeadingDeltaDegrees(a: number, b: number): number {
  const delta = Math.abs(normalizeHeadingDegrees(a) - normalizeHeadingDegrees(b));
  return Math.min(delta, 360 - delta);
}

export function getBearingDegrees(from: LatLng, to: LatLng): number {
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  return normalizeHeadingDegrees((Math.atan2(y, x) * 180) / Math.PI);
}

export function getRouteDeviation(
  point: LatLng,
  polyline: readonly LatLng[],
  gpsHeading: number | null,
  gpsSpeed: number | null,
  positionHistoryBearing: number | null
): {
  readonly distanceMeters: number;
  readonly headingMismatch: boolean;
  readonly headingDeltaDegrees: number | null;
  readonly usedPositionHistoryBearing: boolean;
} {
  if (polyline.length === 0) {
    return {
      distanceMeters: Infinity,
      headingMismatch: false,
      headingDeltaDegrees: null,
      usedPositionHistoryBearing: false,
    };
  }
  if (polyline.length === 1) {
    return {
      distanceMeters: haversineMeters(point, polyline[0]),
      headingMismatch: false,
      headingDeltaDegrees: null,
      usedPositionHistoryBearing: false,
    };
  }

  let minDistance = Infinity;
  let closestSegmentIndex = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const projectedPoint = projectPointOnSegment(point, polyline[i], polyline[i + 1]);
    const distance = haversineMeters(point, projectedPoint);
    if (distance < minDistance) {
      minDistance = distance;
      closestSegmentIndex = i;
    }
  }

  const routeBearing = getBearingDegrees(
    polyline[closestSegmentIndex],
    polyline[closestSegmentIndex + 1]
  );

  const hasReliableHeading =
    gpsHeading !== null &&
    gpsHeading !== -1 &&
    Number.isFinite(gpsHeading) &&
    gpsSpeed !== null &&
    gpsSpeed >= HEADING_SPEED_THRESHOLD_MS;

  let headingDeltaDegrees: number | null = null;
  let usedPositionHistoryBearing = false;

  if (hasReliableHeading) {
    headingDeltaDegrees = getHeadingDeltaDegrees(gpsHeading, routeBearing);
  } else if (positionHistoryBearing !== null) {
    headingDeltaDegrees = getHeadingDeltaDegrees(positionHistoryBearing, routeBearing);
    usedPositionHistoryBearing = true;
  }

  return {
    distanceMeters: minDistance,
    headingMismatch:
      headingDeltaDegrees !== null && headingDeltaDegrees >= HEADING_MISMATCH_DEG,
    headingDeltaDegrees,
    usedPositionHistoryBearing,
  };
}

/**
 * Hook to fetch the driver navigation route (Phase 12 Navigation).
 * Parameterizes target: pickup coords during waiting, destination coords during trip.
 * Refetches on leg start (initial load or target change) or off-route detection (>50m).
 * Eliminates periodic time/distance polling to optimize Google Maps API calls.
 * Publishes driverRoute to Firestore during active navigation phases.
 */
export function useDriverRouteQuery(tripId: string | null) {
  const trip = useActiveTripStore((s) => s.trip);
  const gpsHeading = useActiveTripStore((s) => s.gpsHeading);
  const gpsSpeed = useActiveTripStore((s) => s.gpsSpeed);

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
  const [isRerouting, setIsRerouting] = useState(false);
  const queryCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const lastPublishedRouteRef = useRef<{ polyline: string; distanceMeters: number; durationSeconds: number } | null>(null);
  const currentRouteRef = useRef<NavRoute | null>(null);
  const decodedRoutePointsRef = useRef<{ lat: number; lng: number }[]>([]);
  const isFirstMountRef = useRef<boolean>(true);
  const offRouteConfirmationCountRef = useRef<number>(0);
  const positionHistoryRef = useRef<Array<{ lat: number; lng: number; ts: number }>>([]);
  const lastTargetCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

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
    offRouteConfirmationCountRef.current = 0;
    positionHistoryRef.current = [];
    queryCoordsRef.current = null;
    lastTargetCoordsRef.current = null;
    const resetTimeout = setTimeout(() => {
      setIsRerouting(false);
      setQueryCoords(null);
    }, 0);
    return () => clearTimeout(resetTimeout);
  }, [tripId]);

  useEffect(() => {
    if (!enabled || !targetCoords) {
      queryCoordsRef.current = null;
      lastTargetCoordsRef.current = null;
      lastFetchTimeRef.current = 0;
      offRouteConfirmationCountRef.current = 0;
      positionHistoryRef.current = [];
      const resetTimeout = setTimeout(() => {
        setQueryCoords(null);
        setIsRerouting(false);
      }, 0);
      return () => clearTimeout(resetTimeout);
    }

    const checkAndUpdate = () => {
      if (lastLatitude === null || lastLongitude === null) return;

      const now = Date.now();
      const currentLive = { lat: lastLatitude, lng: lastLongitude };

      // Maintain position-history buffer for low-speed bearing fallback
      const history = positionHistoryRef.current;
      history.push({ lat: lastLatitude, lng: lastLongitude, ts: now });
      while (history.length > 0 && now - history[0].ts > POSITION_HISTORY_MAX_AGE_MS) {
        history.shift();
      }

      // Compute position-history bearing: direction from oldest to newest point
      let positionHistoryBearing: number | null = null;
      if (history.length >= 2) {
        const oldest = history[0];
        const moved = haversineMeters(oldest, currentLive);
        if (moved >= POSITION_HISTORY_MIN_MOVE_M) {
          positionHistoryBearing = getBearingDegrees(oldest, currentLive);
        }
      }

      const activeQueryCoords = queryCoordsRef.current;

      const targetChanged =
        lastTargetCoordsRef.current === null ||
        lastTargetCoordsRef.current.lat !== targetCoords.lat ||
        lastTargetCoordsRef.current.lng !== targetCoords.lng;

      if (!activeQueryCoords || targetChanged) {
        logger.info('[useDriverRouteQuery] Initializing query coordinates (leg start)', { currentLive, targetCoords });
        lastTargetCoordsRef.current = { lat: targetCoords.lat, lng: targetCoords.lng };
        queryCoordsRef.current = currentLive;
        setQueryCoords(currentLive);
        lastFetchTimeRef.current = now;
        return;
      }

      // Check off-route trigger. A single bad GPS sample should not reroute;
      // require consecutive confirmations, optionally strengthened by heading.
      if (currentRouteRef.current && currentRouteRef.current.overviewPolyline) {
        const decodedPoints = decodedRoutePointsRef.current;
        if (decodedPoints.length > 0) {
          const deviation = getRouteDeviation(
            currentLive,
            decodedPoints,
            gpsHeading,
            gpsSpeed,
            positionHistoryBearing
          );
          const shouldConfirmOffRoute =
            deviation.distanceMeters >= OFF_ROUTE_M || deviation.headingMismatch;
          // Heading mismatch is a strong directional signal — confirm immediately
          const confirmationsNeeded = deviation.headingMismatch ? 1 : OFF_ROUTE_CONFIRMATION_COUNT;

          if (shouldConfirmOffRoute) {
            offRouteConfirmationCountRef.current += 1;
          } else {
            offRouteConfirmationCountRef.current = 0;
          }

          if (offRouteConfirmationCountRef.current >= confirmationsNeeded) {
            logger.info('[useDriverRouteQuery] Off-route confirmed. Forcing route refresh.', {
              offRouteDist: deviation.distanceMeters,
              headingMismatch: deviation.headingMismatch,
              headingDeltaDegrees: deviation.headingDeltaDegrees,
              usedPositionHistoryBearing: deviation.usedPositionHistoryBearing,
              confirmations: offRouteConfirmationCountRef.current,
              currentLive,
            });
            offRouteConfirmationCountRef.current = 0;
            positionHistoryRef.current = [];
            queryCoordsRef.current = currentLive;
            setIsRerouting(true);
            setQueryCoords(currentLive);
            lastFetchTimeRef.current = now;
            return;
          }
        }
      }
    };

    // Run check immediately when location or target coordinates change
    checkAndUpdate();
  }, [lastLatitude, lastLongitude, targetCoords?.lat, targetCoords?.lng, status, enabled, gpsHeading, gpsSpeed]);

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
      const timeout = setTimeout(() => {
        setIsRerouting(false);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [query.data]);

  useEffect(() => {
    if (query.error) {
      const timeout = setTimeout(() => {
        setIsRerouting(false);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [query.error]);

  // Publish to Firestore whenever a driver navigation route is available.
  // - During accepted / driver_arriving the polyline represents driver → pickup.
  // - During in_progress the polyline represents driver → destination and lets
  //   the passenger see the same live navigation route the driver is following
  //   (Grab / Uber parity).
  useEffect(() => {
    if (!tripId || !query.data || !enabled) return;
    if (!isToPickup && !isToDestination) return;

    const overviewPolyline = query.data.overviewPolyline;
    const distanceMeters = Math.max(0, Math.round(query.data.distanceMeters));
    const durationSeconds = Math.max(0, Math.round(query.data.durationSeconds));

    if (
      !overviewPolyline ||
      typeof overviewPolyline !== 'string' ||
      !Number.isFinite(distanceMeters) ||
      !Number.isFinite(durationSeconds)
    ) {
      return;
    }

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
  }, [query.data, tripId, enabled, isToPickup, isToDestination]);

  return {
    ...query,
    // Return null route if not enabled, ensuring the polyline disappears immediately on status change
    data: enabled ? query.data : undefined,
    isRerouting: enabled && isRerouting && query.isFetching,
  };
}

