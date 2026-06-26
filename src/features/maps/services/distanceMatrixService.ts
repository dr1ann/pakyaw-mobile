import Constants from 'expo-constants';
import { env } from '@/services/env';
import { logger } from '@/lib/logger';

const GOOGLE_MAPS_API_KEY =
  Constants.expoConfig?.extra?.googleMapsApiKey ||
  env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export type DistanceMatrixResult = {
  readonly distanceMeters: number;
  readonly etaSeconds: number;
};

/**
 * Fetch ETA and distance between a driver and a pickup location from Google Distance Matrix API (Phase 12).
 */
export async function getDriverToPickup(
  driverCoords: { readonly latitude: number; readonly longitude: number },
  pickupCoords: { readonly lat: number; readonly lng: number }
): Promise<DistanceMatrixResult | null> {
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${driverCoords.latitude},${driverCoords.longitude}&destinations=${pickupCoords.lat},${pickupCoords.lng}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    logger.info('[distanceMatrixService] Fetching driver to pickup ETA', {
      driver: driverCoords,
      pickup: pickupCoords,
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status && data.status !== 'OK') {
      logger.error('[distanceMatrixService] Distance Matrix API error', { status: data.status });
      return null;
    }

    const row = data.rows?.[0];
    const element = row?.elements?.[0];

    if (!element || element.status !== 'OK') {
      logger.error('[distanceMatrixService] Element status is not OK', {
        elementStatus: element?.status,
      });
      return null;
    }

    return {
      distanceMeters: element.distance.value,
      etaSeconds: element.duration.value,
    };
  } catch (err) {
    logger.error('[distanceMatrixService] getDriverToPickup failed', { err });
    return null;
  }
}
