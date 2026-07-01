import { haversineMeters } from './geo';

export type LatLng = { readonly lat: number; readonly lng: number };

/**
 * Projects a point onto a line segment [a, b] using a flat local conformal projection.
 * Snaps to segment endpoints if the projection falls outside the segment.
 */
export function projectPointOnSegment(
  p: LatLng,
  a: LatLng,
  b: LatLng
): LatLng {
  const aLatRad = (a.lat * Math.PI) / 180;
  const cosLat = Math.cos(aLatRad);

  const x = p.lng * cosLat;
  const y = p.lat;
  const ax = a.lng * cosLat;
  const ay = a.lat;
  const bx = b.lng * cosLat;
  const by = b.lat;

  const abx = bx - ax;
  const aby = by - ay;
  const apx = x - ax;
  const apy = y - ay;

  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return a;

  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));

  return {
    lat: ay + t * aby,
    lng: (ax + t * abx) / cosLat,
  };
}

/**
 * Finds the minimum distance from a point to any segment of a polyline.
 */
export function getMinDistanceToPolyline(
  point: LatLng,
  polyline: LatLng[]
): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return haversineMeters(point, polyline[0]);

  let minDistance = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const proj = projectPointOnSegment(point, a, b);
    const dist = haversineMeters(point, proj);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}

/**
 * Projects a point onto the closest segment of a polyline.
 */
export function snapPointToPolyline(
  point: LatLng,
  polyline: readonly LatLng[]
): LatLng | null {
  if (polyline.length === 0) return null;
  if (polyline.length === 1) return polyline[0];

  let minDistance = Infinity;
  let closestPoint = polyline[0];

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const projectedPoint = projectPointOnSegment(point, a, b);
    const distance = haversineMeters(point, projectedPoint);

    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = projectedPoint;
    }
  }

  return closestPoint;
}

function isSamePoint(a: LatLng, b: LatLng): boolean {
  return a.lat === b.lat && a.lng === b.lng;
}

function appendPoint(points: LatLng[], point: LatLng): LatLng[] {
  const lastPoint = points[points.length - 1];
  if (lastPoint && isSamePoint(lastPoint, point)) {
    return points;
  }
  return [...points, point];
}

/**
 * Splits a polyline at the point closest to the supplied position.
 * The original geometry is preserved; the projected split point is inserted
 * into both returned arrays so rendering can fade the consumed segment and
 * keep the remaining segment highlighted.
 */
export function splitPolylineAtClosestPoint(
  point: LatLng,
  polyline: readonly LatLng[]
): {
  readonly consumed: readonly LatLng[];
  readonly remaining: readonly LatLng[];
  readonly splitPoint: LatLng | null;
  readonly segmentIndex: number | null;
} {
  if (polyline.length === 0) {
    return { consumed: [], remaining: [], splitPoint: null, segmentIndex: null };
  }
  if (polyline.length === 1) {
    return {
      consumed: [polyline[0]],
      remaining: [polyline[0]],
      splitPoint: polyline[0],
      segmentIndex: 0,
    };
  }

  let minDistance = Infinity;
  let splitPoint = polyline[0];
  let segmentIndex = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const projectedPoint = projectPointOnSegment(point, polyline[i], polyline[i + 1]);
    const distance = haversineMeters(point, projectedPoint);

    if (distance < minDistance) {
      minDistance = distance;
      splitPoint = projectedPoint;
      segmentIndex = i;
    }
  }

  const consumed = appendPoint(polyline.slice(0, segmentIndex + 1), splitPoint);
  const remainingStart = isSamePoint(splitPoint, polyline[segmentIndex + 1])
    ? polyline.slice(segmentIndex + 1)
    : [splitPoint, ...polyline.slice(segmentIndex + 1)];

  return {
    consumed,
    remaining: remainingStart,
    splitPoint,
    segmentIndex,
  };
}

/**
 * Calculates the remaining distance to the end of a step's polyline
 * starting from the driver's current projected position on that polyline.
 */
export function getDistanceToStepEnd(
  point: LatLng,
  step: { polyline: LatLng[] }
): number {
  const poly = step.polyline;
  if (poly.length === 0) return 0;
  if (poly.length === 1) return haversineMeters(point, poly[0]);

  let minDistance = Infinity;
  let segmentIndex = 0;
  let closestPoint = poly[0];

  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const proj = projectPointOnSegment(point, a, b);
    const dist = haversineMeters(point, proj);
    if (dist < minDistance) {
      minDistance = dist;
      closestPoint = proj;
      segmentIndex = i;
    }
  }

  let distToEnd = haversineMeters(closestPoint, poly[segmentIndex + 1]);
  for (let i = segmentIndex + 1; i < poly.length - 1; i++) {
    distToEnd += haversineMeters(poly[i], poly[i + 1]);
  }

  return distToEnd;
}

/**
 * Projects a point onto a polyline, returns the closest point coordinates,
 * the index of the closest segment, and the total remaining distance along the polyline.
 */
export function getRemainingDistance(
  point: LatLng,
  polyline: LatLng[]
): {
  readonly remainingDistanceMeters: number;
  readonly closestPoint: LatLng;
  readonly segmentIndex: number;
} {
  if (polyline.length === 0) {
    return { remainingDistanceMeters: 0, closestPoint: point, segmentIndex: 0 };
  }
  if (polyline.length === 1) {
    return { remainingDistanceMeters: haversineMeters(point, polyline[0]), closestPoint: polyline[0], segmentIndex: 0 };
  }

  let minDistance = Infinity;
  let closestPoint = polyline[0];
  let segmentIndex = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const proj = projectPointOnSegment(point, a, b);
    const dist = haversineMeters(point, proj);
    if (dist < minDistance) {
      minDistance = dist;
      closestPoint = proj;
      segmentIndex = i;
    }
  }

  let remainingDistanceMeters = haversineMeters(closestPoint, polyline[segmentIndex + 1]);
  for (let i = segmentIndex + 1; i < polyline.length - 1; i++) {
    remainingDistanceMeters += haversineMeters(polyline[i], polyline[i + 1]);
  }

  return { remainingDistanceMeters, closestPoint, segmentIndex };
}
