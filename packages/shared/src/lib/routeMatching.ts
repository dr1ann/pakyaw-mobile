import type { Place } from '@pakyaw/shared/types/place';
import { haversineMeters, type LatLng } from './geo';
import type { SharedRideDoc } from '../features/trip/types';

// Polyline decoding (Google Maps algorithm)
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

export function computeBearing(from: LatLng, to: LatLng): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  let brng = Math.atan2(y, x);
  brng = (brng * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function angularDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function nearestPointOnPolyline(
  point: LatLng,
  polyline: readonly LatLng[]
): { distanceMeters: number; progress: number } {
  if (polyline.length === 0) return { distanceMeters: Infinity, progress: 0 };
  if (polyline.length === 1) {
    return { distanceMeters: haversineMeters(point, polyline[0]), progress: 0 };
  }

  let minDistance = Infinity;
  let bestProgress = 0;

  // Simple approximation: project point onto segments. For now, just finding the nearest vertex
  // is often sufficient for high-resolution polylines, but we'll do segment projection.
  
  let totalLength = 0;
  const segmentLengths: number[] = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const len = haversineMeters(polyline[i], polyline[i + 1]);
    segmentLengths.push(len);
    totalLength += len;
  }

  let currentLength = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const A = polyline[i];
    const B = polyline[i + 1];
    const segLen = segmentLengths[i];

    // Distance from point to segment AB
    const d1 = haversineMeters(point, A);
    const d2 = haversineMeters(point, B);

    // This is a rough estimation of cross-track distance
    // A proper spherical projection is better, but this works for short segments
    let closestDist = Math.min(d1, d2);
    let fraction = d1 < d2 ? 0 : 1;
    
    if (segLen > 0) {
      // Very rough planar projection for small distances
      const dot =
        ((point.lat - A.lat) * (B.lat - A.lat) + (point.lng - A.lng) * (B.lng - A.lng)) /
        (Math.pow(B.lat - A.lat, 2) + Math.pow(B.lng - A.lng, 2));
      
      if (dot >= 0 && dot <= 1) {
        const projLat = A.lat + dot * (B.lat - A.lat);
        const projLng = A.lng + dot * (B.lng - A.lng);
        closestDist = haversineMeters(point, { lat: projLat, lng: projLng });
        fraction = dot;
      }
    }

    if (closestDist < minDistance) {
      minDistance = closestDist;
      bestProgress = totalLength > 0 ? (currentLength + fraction * segLen) / totalLength : 0;
    }
    
    currentLength += segLen;
  }

  return { distanceMeters: minDistance, progress: bestProgress };
}

export type CompatibilityResult =
  | { compatible: true; pickupDistance: number; dropoffDistance: number }
  | { compatible: false; reason: string };

export function isRouteCompatible(
  sharedRide: Pick<SharedRideDoc, 'routePolyline' | 'routeHeadingDeg' | 'corridorThresholdMeters' | 'seatsBooked' | 'maxSeats'>,
  hopOnPickup: Place,
  hopOnDest: Place,
  hopOnSeats: number,
  driverLocation: LatLng
): CompatibilityResult {
  if (!hopOnPickup.coords || !hopOnDest.coords) {
    return { compatible: false, reason: 'Missing coordinates' };
  }

  if (sharedRide.seatsBooked + hopOnSeats > sharedRide.maxSeats) {
    return { compatible: false, reason: 'Not enough seats' };
  }

  const hopOnHeading = computeBearing(hopOnPickup.coords, hopOnDest.coords);
  if (angularDifference(hopOnHeading, sharedRide.routeHeadingDeg) > 60) {
    return { compatible: false, reason: 'Going wrong direction' };
  }

  const polyline = decodePolyline(sharedRide.routePolyline);
  
  const pickupProj = nearestPointOnPolyline(hopOnPickup.coords, polyline);
  if (pickupProj.distanceMeters > sharedRide.corridorThresholdMeters) {
    return { compatible: false, reason: 'Pickup too far from route' };
  }

  const destProj = nearestPointOnPolyline(hopOnDest.coords, polyline);
  if (destProj.distanceMeters > sharedRide.corridorThresholdMeters) {
    return { compatible: false, reason: 'Destination too far from route' };
  }

  // Check if passenger is behind driver
  const driverProj = nearestPointOnPolyline(driverLocation, polyline);
  // Allow a 5% tolerance (if they are slightly behind, we can still pick them up)
  if (pickupProj.progress < driverProj.progress - 0.05) {
    return { compatible: false, reason: 'Pickup is behind driver' };
  }

  return { 
    compatible: true, 
    pickupDistance: pickupProj.distanceMeters,
    dropoffDistance: destProj.distanceMeters 
  };
}
