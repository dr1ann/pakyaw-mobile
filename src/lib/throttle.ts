import { haversineMeters, type LatLng } from '@/lib/geo';

export const THROTTLE_MIN_INTERVAL_MS = 4_000;
export const THROTTLE_MIN_DISTANCE_M = 25;

export type ThrottleInput = {
  readonly lastAt: number | null;
  readonly lastGeo: LatLng | null;
  readonly now: number;
  readonly geo: LatLng;
};

export function shouldEmit({ lastAt, lastGeo, now, geo }: ThrottleInput): boolean {
  if (lastAt === null || lastGeo === null) return true;
  if (now - lastAt >= THROTTLE_MIN_INTERVAL_MS) return true;
  if (haversineMeters(lastGeo, geo) >= THROTTLE_MIN_DISTANCE_M) return true;
  return false;
}
