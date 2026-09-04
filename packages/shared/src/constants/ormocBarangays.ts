/**
 * Curated Ormoc City Barangay Boundaries and Centroids for Pilot Area.
 * Provides fast, offline-capable local barangay resolution to enrich reverse-geocoded coordinates.
 */

export interface OrmocBarangay {
  readonly name: string;
  readonly center: { readonly lat: number; readonly lng: number };
  readonly bounds?: {
    readonly north: number;
    readonly south: number;
    readonly east: number;
    readonly west: number;
  };
}

export const ORMOC_BARANGAYS: readonly OrmocBarangay[] = [
  {
    name: 'Camp Downes',
    center: { lat: 10.9959, lng: 124.6183 },
    bounds: { north: 11.0030, south: 10.9880, east: 124.6260, west: 124.6120 },
  },
  {
    name: 'Linao',
    center: { lat: 11.0345, lng: 124.6012 },
    bounds: { north: 11.0450, south: 11.0280, east: 124.6100, west: 124.5940 },
  },
  {
    name: 'Cogon',
    center: { lat: 11.0254, lng: 124.6050 },
    bounds: { north: 11.0300, south: 11.0180, east: 124.6120, west: 124.5980 },
  },
  {
    name: 'San Pedro',
    center: { lat: 11.0049, lng: 124.6098 },
    bounds: { north: 11.0100, south: 11.0000, east: 124.6150, west: 124.6060 },
  },
  {
    name: 'Can-adieng',
    center: { lat: 11.0080, lng: 124.6010 },
    bounds: { north: 11.0140, south: 11.0020, east: 124.6060, west: 124.5950 },
  },
  {
    name: 'Punta',
    center: { lat: 11.0000, lng: 124.6025 },
    bounds: { north: 11.0050, south: 10.9920, east: 124.6070, west: 124.5970 },
  },
  {
    name: 'Ipil',
    center: { lat: 11.0070, lng: 124.6250 },
    bounds: { north: 11.0150, south: 10.9990, east: 124.6330, west: 124.6170 },
  },
  {
    name: 'Alta Vista',
    center: { lat: 11.0200, lng: 124.6200 },
    bounds: { north: 11.0280, south: 11.0120, east: 124.6300, west: 124.6120 },
  },
  {
    name: 'Tambulilid',
    center: { lat: 11.0380, lng: 124.5950 },
    bounds: { north: 11.0480, south: 11.0310, east: 124.6020, west: 124.5870 },
  },
  {
    name: 'Don Felipe Larrazabal',
    center: { lat: 11.0150, lng: 124.6000 },
    bounds: { north: 11.0220, south: 11.0090, east: 124.6060, west: 124.5930 },
  },
  {
    name: 'Dolores',
    center: { lat: 11.0600, lng: 124.6200 },
    bounds: { north: 11.0750, south: 11.0450, east: 124.6350, west: 124.6050 },
  },
  {
    name: 'Valencia',
    center: { lat: 11.0800, lng: 124.6000 },
    bounds: { north: 11.0950, south: 11.0650, east: 124.6150, west: 124.5850 },
  },
];

/**
 * Fast approximate haversine distance in meters.
 */
function fastDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Resolves the Ormoc City barangay for a given coordinate pair.
 * Checks bounding boxes first, then proximity to barangay center within 1.5km.
 */
export function lookupOrmocBarangay(lat: number, lng: number): string | null {
  // 1. Strict bounding box match
  for (const b of ORMOC_BARANGAYS) {
    if (b.bounds) {
      if (
        lat >= b.bounds.south &&
        lat <= b.bounds.north &&
        lng >= b.bounds.west &&
        lng <= b.bounds.east
      ) {
        return b.name;
      }
    }
  }

  // 2. Proximity match within 1500 meters
  let closestBarangay: string | null = null;
  let minDistance = 1500; // meters

  for (const b of ORMOC_BARANGAYS) {
    const dist = fastDistanceMeters(lat, lng, b.center.lat, b.center.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestBarangay = b.name;
    }
  }

  return closestBarangay;
}
