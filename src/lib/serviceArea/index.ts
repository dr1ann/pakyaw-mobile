import type { LatLng } from '@pakyaw/shared/lib/geo';
import type { Place } from '@pakyaw/shared/types/place';
import { ORMOC_SERVICE_AREA } from './ormoc';

export class ServiceAreaError extends Error {
  readonly placeLabel: string;

  constructor(placeLabel: string) {
    super(`Location "${placeLabel}" is outside the Ormoc City service area.`);
    this.name = 'ServiceAreaError';
    this.placeLabel = placeLabel;
    
    // Set prototype explicitly to ensure instanceof works correctly in TS/JS
    Object.setPrototypeOf(this, ServiceAreaError.prototype);
  }
}

export const MIN_ROUTE_DISTANCE_METERS = 50;
export const MAX_ROUTE_DISTANCE_METERS = 60_000;

export function isRouteDistanceTooShort(meters: number): boolean {
  return meters < MIN_ROUTE_DISTANCE_METERS;
}

export class TripDistanceTooShortError extends Error {
  readonly distanceMeters: number;

  constructor(distanceMeters: number) {
    super('Pickup and destination are too close.');
    this.name = 'TripDistanceTooShortError';
    this.distanceMeters = distanceMeters;
    
    Object.setPrototypeOf(this, TripDistanceTooShortError.prototype);
  }
}

export class MinTripDistanceError extends Error {
  readonly distanceMeters: number;

  constructor(distanceMeters: number) {
    super('Pickup and destination are too close.');
    this.name = 'MinTripDistanceError';
    this.distanceMeters = distanceMeters;
    
    Object.setPrototypeOf(this, MinTripDistanceError.prototype);
  }
}

export function isInServiceArea(
  coords: LatLng | { readonly latitude: number; readonly longitude: number } | null
): boolean {
  if (!coords) return false;
  const lat = 'lat' in coords ? coords.lat : coords.latitude;
  const lng = 'lng' in coords ? coords.lng : coords.longitude;

  const { bounds } = ORMOC_SERVICE_AREA;
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
}

export function assertInServiceArea(place: Place): void {
  if (!place.coords || !isInServiceArea(place.coords)) {
    throw new ServiceAreaError(place.label);
  }
}
