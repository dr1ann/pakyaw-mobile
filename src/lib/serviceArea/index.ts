import type { LatLng } from '@/lib/geo';
import type { Place } from '@/features/booking/types';
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
