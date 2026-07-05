export type LatLng = { readonly lat: number; readonly lng: number };

const EARTH_RADIUS_M = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

interface GeohashBbox {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

function decodeBbox(hash: string): GeohashBbox {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let evenBit = true;

  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    for (let bit = 4; bit >= 0; bit--) {
      const bitVal = (idx >> bit) & 1;
      if (evenBit) {
        const mid = (lngMin + lngMax) / 2;
        if (bitVal) lngMin = mid;
        else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (bitVal) latMin = mid;
        else latMax = mid;
      }
      evenBit = !evenBit;
    }
  }

  return { latMin, latMax, lngMin, lngMax };
}

export function geohashNeighbors(hash: string): readonly string[] {
  const { latMin, latMax, lngMin, lngMax } = decodeBbox(hash);
  const latCenter = (latMin + latMax) / 2;
  const lngCenter = (lngMin + lngMax) / 2;
  const latDelta = latMax - latMin;
  const lngDelta = lngMax - lngMin;
  const precision = hash.length;

  const offsets: readonly [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const [dLat, dLng] of offsets) {
    const lat = latCenter + dLat * latDelta;
    const lng = lngCenter + dLng * lngDelta;
    const neighbor = geohashOf({ lat, lng }, precision);
    if (!seen.has(neighbor)) {
      seen.add(neighbor);
      result.push(neighbor);
    }
  }

  return result;
}

export function geohashOf(point: LatLng, precision = 7): string {
  if (precision < 1 || precision > 12) {
    throw new Error(`geohash precision out of range: ${precision}`);
  }

  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  let hash = '';
  let bits = 0;
  let bit = 0;
  let evenBit = true;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (point.lng >= mid) {
        bits = (bits << 1) | 1;
        lngMin = mid;
      } else {
        bits = bits << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (point.lat >= mid) {
        bits = (bits << 1) | 1;
        latMin = mid;
      } else {
        bits = bits << 1;
        latMax = mid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      hash += BASE32[bits];
      bits = 0;
      bit = 0;
    }
  }

  return hash;
}
