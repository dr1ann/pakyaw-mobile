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

const VALID_MANEUVERS = new Set<string>([
  'turn-left',
  'turn-right',
  'turn-slight-left',
  'turn-slight-right',
  'turn-sharp-left',
  'turn-sharp-right',
  'uturn-left',
  'uturn-right',
  'straight',
  'ramp-left',
  'ramp-right',
  'merge',
  'fork-left',
  'fork-right',
  'keep-left',
  'keep-right',
  'roundabout-left',
  'roundabout-right',
  'ferry',
  'depart',
  'arrive',
]);

function parseManeuver(m: string | null | undefined): Maneuver | null {
  if (!m) return null;
  const normalized = m.toLowerCase().replace(/_/g, '-');
  return VALID_MANEUVERS.has(normalized) ? (normalized as Maneuver) : null;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export function extractRoadName(instruction: string): string | null {
  const match = instruction.match(/(?:onto|on)\s+([^,.]+?)(?:\s+toward|\s+destination|$)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

import { decodePolyline } from '@/lib/maps/decodePolyline';
import { navRouteResponseSchema } from '@/features/booking/validation/bookingSchema';
import type { NavRoute, NavStep, Maneuver } from '../navigation/types';

/**
 * Fetch a navigation route with detailed steps from Google Directions API (Phase 12 Navigation).
 */
export async function getNavigationRoute(
  origin: { readonly lat: number; readonly lng: number },
  destination: { readonly lat: number; readonly lng: number }
): Promise<NavRoute> {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    logger.info('[routingService] Fetching navigation route', {
      origin,
      destination,
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
    const parsed = navRouteResponseSchema.safeParse(data);
    if (!parsed.success) {
      logger.error('[routingService] Schema validation failed', {
        errors: parsed.error.issues,
      });
      throw new RoutingError('Invalid response format from routing service.');
    }

    const route = parsed.data.routes[0];
    const leg = route.legs[0];

    const steps: NavStep[] = leg.steps.map((step) => {
      const strippedInstruction = stripHtml(step.html_instructions);
      const roadName = extractRoadName(strippedInstruction);
      const stepPolyline = decodePolyline(step.polyline.points);

      return {
        maneuver: parseManeuver(step.maneuver),
        instruction: strippedInstruction,
        roadName,
        distanceMeters: step.distance.value,
        startLocation: { lat: step.start_location.lat, lng: step.start_location.lng },
        endLocation: { lat: step.end_location.lat, lng: step.end_location.lng },
        polyline: stepPolyline,
      };
    });

    return {
      steps,
      overviewPolyline: route.overview_polyline.points,
      distanceMeters: leg.distance.value,
      durationSeconds: leg.duration.value,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    logger.error('[routingService] getNavigationRoute failed', { err });
    if (err instanceof RoutingError) throw err;
    throw new RoutingError();
  }
}

