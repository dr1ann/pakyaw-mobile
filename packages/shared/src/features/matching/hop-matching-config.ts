/**
 * hop-matching-config.ts — Dynamic Hop Matching parameters and math utilities.
 */

import { haversineMeters } from '../../lib/geo';

export interface HopMatchingConfig {
  readonly searchRadiusKm: number;
  readonly corridorWidthMeters: number;
  readonly forwardAngleDeg: number;
  readonly matchingToleranceMeters: number;
  readonly maxPickupDeviationMeters: number;
  readonly maxSharedPassengers: number;
  readonly maxHopSeatsPerPassenger: number;
}

export const DEFAULT_HOP_MATCHING_CONFIG: HopMatchingConfig = {
  searchRadiusKm: 3.0,
  corridorWidthMeters: 500,
  forwardAngleDeg: 60,
  matchingToleranceMeters: 100,
  maxPickupDeviationMeters: 300,
  maxSharedPassengers: 6,
  maxHopSeatsPerPassenger: 1,
};

/**
 * Calculates bearing heading in degrees (0..360) from origin to destination.
 */
export function calculateHeadingAngle(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): number {
  const lat1 = (origin.lat * Math.PI) / 180;
  const lat2 = (destination.lat * Math.PI) / 180;
  const dLng = ((destination.lng - origin.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Evaluates whether passenger pickup point lies within driver's forward travel cone.
 * Uses dot product angle validation.
 */
export function isForwardDirection(
  driverLoc: { lat: number; lng: number },
  driverHeadingDeg: number,
  passengerLoc: { lat: number; lng: number },
  maxAngleDeg: number
): boolean {
  const headingToPassenger = calculateHeadingAngle(driverLoc, passengerLoc);
  let diff = Math.abs(driverHeadingDeg - headingToPassenger);
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff <= maxAngleDeg;
}

/**
 * Calculates perpendicular distance (meters) of a point relative to a line segment.
 */
export function calculatePerpendicularDistanceMeters(
  point: { lat: number; lng: number },
  lineStart: { lat: number; lng: number },
  lineEnd: { lat: number; lng: number }
): number {
  const dStart = haversineMeters(point, lineStart);
  const dEnd = haversineMeters(point, lineEnd);
  const lineLen = haversineMeters(lineStart, lineEnd);

  if (lineLen === 0) return dStart;

  // Semi-perimeter Heron's formula approximation for cross-track distance
  const s = (dStart + dEnd + lineLen) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - dStart) * (s - dEnd) * (s - lineLen)));
  const perpDist = (2 * area) / lineLen;

  return isNaN(perpDist) ? Math.min(dStart, dEnd) : perpDist;
}

/**
 * Validates if a passenger's pickup location is inside the driver's active corridor and ahead of the driver.
 */
export function isPassengerInCorridor(
  driverLoc: { lat: number; lng: number },
  driverHeadingDeg: number,
  passengerLoc: { lat: number; lng: number },
  routeOrigin: { lat: number; lng: number },
  routeDestination: { lat: number; lng: number },
  config: HopMatchingConfig = DEFAULT_HOP_MATCHING_CONFIG
): boolean {
  // 1. Direct Search Radius Check
  const directDistMeters = haversineMeters(driverLoc, passengerLoc);
  if (directDistMeters > config.searchRadiusKm * 1000) {
    return false;
  }

  // 2. Forward Range Validation (Dot-product angle)
  const isAhead = isForwardDirection(
    driverLoc,
    driverHeadingDeg,
    passengerLoc,
    config.forwardAngleDeg
  );
  if (!isAhead) {
    return false;
  }

  // 3. Corridor Width Validation (Perpendicular distance from active route)
  const perpDistMeters = calculatePerpendicularDistanceMeters(
    passengerLoc,
    routeOrigin,
    routeDestination
  );
  if (perpDistMeters > config.corridorWidthMeters) {
    return false;
  }

  return true;
}
