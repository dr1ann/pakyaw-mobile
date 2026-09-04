import { useEffect, useState, useMemo } from 'react';
import { firestore, doc, onSnapshot } from '@/services/firebase/firebase';
import { haversineMeters } from '@pakyaw/shared/lib/geo';
import { logger } from '@pakyaw/shared/lib/logger';

export const STALE_LOCATION_THRESHOLD_MS = 60_000;
const PRE_PICKUP_STATUSES = new Set(['accepted', 'driver_arriving', 'driver_arrived']);

export type PassengerLiveLocationData = {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters?: number | null;
  readonly updatedAtMillis?: number | null;
};

export type UsePassengerLiveLocationResult = {
  readonly passengerLocation: PassengerLiveLocationData | null;
  readonly isStale: boolean;
  readonly distanceToPickupMeters: number | null;
  readonly formattedDistanceToPickup: string | null;
};

export function formatPassengerToPickupDistance(distanceMeters: number | null): string | null {
  if (distanceMeters == null || !Number.isFinite(distanceMeters) || distanceMeters < 0) {
    return null;
  }
  if (distanceMeters < 50) {
    return 'Passenger is near the pickup';
  }
  if (distanceMeters < 1000) {
    return `Passenger is ~${Math.round(distanceMeters)} m from pickup`;
  }
  return `Passenger is ${(distanceMeters / 1000).toFixed(1)} km from pickup`;
}

export function usePassengerLiveLocation(
  tripId: string | null | undefined,
  status: string | null | undefined,
  pickupCoords: { lat: number; lng: number } | null | undefined
): UsePassengerLiveLocationResult {
  const [locationData, setLocationData] = useState<PassengerLiveLocationData | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const isPrePickup = !!tripId && !!status && PRE_PICKUP_STATUSES.has(status);

  // Periodic clock update for staleness checking
  useEffect(() => {
    if (!isPrePickup) return;
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10_000);
    return () => clearInterval(interval);
  }, [isPrePickup]);

  useEffect(() => {
    if (!isPrePickup || !tripId) {
      return;
    }

    logger.info('[usePassengerLiveLocation] Subscribing to passenger location', { tripId, status });
    const locationRef = doc(firestore, 'passengerLocations', tripId);

    const unsubscribe = onSnapshot(
      locationRef,
      (snapshot) => {
        if (!snapshot || !snapshot.exists) {
          setLocationData(null);
          return;
        }

        const data = (typeof snapshot.data === 'function' ? snapshot.data() : snapshot.data) as Record<string, any> | undefined;
        if (!data || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
          setLocationData(null);
          return;
        }

        let updatedAtMillis: number | null = null;
        if (data.updatedAt) {
          if (typeof data.updatedAt.toMillis === 'function') {
            updatedAtMillis = data.updatedAt.toMillis();
          } else if (typeof data.updatedAt.toDate === 'function') {
            updatedAtMillis = data.updatedAt.toDate().getTime();
          } else if (typeof data.updatedAt === 'number') {
            updatedAtMillis = data.updatedAt;
          }
        }

        setLocationData({
          latitude: data.latitude,
          longitude: data.longitude,
          accuracyMeters: typeof data.accuracyMeters === 'number' ? data.accuracyMeters : null,
          updatedAtMillis,
        });
      },
      (error) => {
        logger.warn('[usePassengerLiveLocation] Snapshot error or permission denied', { tripId, error: String(error) });
        setLocationData(null);
      }
    );

    return () => {
      logger.info('[usePassengerLiveLocation] Unsubscribing from passenger location', { tripId });
      setLocationData(null);
      unsubscribe();
    };
  }, [isPrePickup, tripId, status]);

  const effectiveLocation = isPrePickup ? locationData : null;

  const isStale = useMemo(() => {
    if (!effectiveLocation || effectiveLocation.updatedAtMillis == null) return false;
    return currentTime - effectiveLocation.updatedAtMillis > STALE_LOCATION_THRESHOLD_MS;
  }, [effectiveLocation, currentTime]);

  const distanceToPickupMeters = useMemo(() => {
    if (!effectiveLocation || !pickupCoords || isStale) return null;
    return haversineMeters(
      { lat: effectiveLocation.latitude, lng: effectiveLocation.longitude },
      pickupCoords
    );
  }, [effectiveLocation, pickupCoords, isStale]);

  const formattedDistanceToPickup = useMemo(() => {
    if (isStale || !effectiveLocation) return null;
    return formatPassengerToPickupDistance(distanceToPickupMeters);
  }, [distanceToPickupMeters, isStale, effectiveLocation]);

  return {
    passengerLocation: isStale ? null : effectiveLocation,
    isStale,
    distanceToPickupMeters,
    formattedDistanceToPickup,
  };
}
