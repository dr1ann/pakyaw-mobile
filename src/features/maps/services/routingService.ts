import Constants from 'expo-constants';
import { env } from '@/services/env';
import { routeResponseSchema } from '@/features/booking/validation/bookingSchema';
import { logger } from '@/lib/logger';

const GOOGLE_MAPS_API_KEY =
  Constants.expoConfig?.extra?.googleMapsApiKey ||
  env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export class RoutingError extends Error {
  constructor(message = 'Could not calculate route — please try again.') {
    super(message);
    this.name = 'RoutingError';
    Object.setPrototypeOf(this, RoutingError.prototype);
  }
}

export type RouteResult = {
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly polyline: string;
};

/**
 * Fetch a route from Google Directions API (Phase 12).
 */
export async function getRoute(
  pickupCoords: { readonly lat: number; readonly lng: number },
  destinationCoords: { readonly lat: number; readonly lng: number }
): Promise<RouteResult> {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${pickupCoords.lat},${pickupCoords.lng}&destination=${destinationCoords.lat},${destinationCoords.lng}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    logger.info('[routingService] Fetching route', {
      origin: pickupCoords,
      destination: destinationCoords,
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    
    // Check if Google returned a status error
    if (data.status && data.status !== 'OK') {
      logger.error('[routingService] Google Directions API returned non-OK status', {
        status: data.status,
        error_message: data.error_message,
      });
      throw new RoutingError(data.error_message || `Directions API status: ${data.status}`);
    }

    // Validate using Zod schema
    const parsed = routeResponseSchema.safeParse(data);
    if (!parsed.success) {
      logger.error('[routingService] Schema validation failed', {
        errors: parsed.error.issues,
      });
      throw new RoutingError('Invalid response format from routing service.');
    }

    const route = parsed.data.routes[0];
    const leg = route.legs[0];

    return {
      distanceMeters: leg.distance.value,
      durationSeconds: leg.duration.value,
      polyline: route.overview_polyline.points,
    };
  } catch (err) {
    logger.error('[routingService] getRoute failed', { err });
    if (err instanceof RoutingError) throw err;
    throw new RoutingError();
  }
}
