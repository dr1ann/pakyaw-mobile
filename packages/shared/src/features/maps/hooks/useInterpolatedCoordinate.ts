import { useEffect, useRef, useState } from 'react';

export type InterpolatedCoordinate = {
  readonly latitude: number;
  readonly longitude: number;
};

const DEFAULT_INTERPOLATION_MS = 1_000;
const MIN_INTERPOLATION_MS = 250;
const MAX_INTERPOLATION_MS = 2_000;
const DEAD_RECKON_MAX_SECONDS = 5;
const DEAD_RECKON_MAX_METERS = 50;
const DEAD_RECKON_MIN_SPEED_MPS = 0.5;
const EARTH_RADIUS_M = 6_371_000;
const STATE_UPDATE_THROTTLE_MS = 66; // ~15fps — prevents ANR from 60fps state updates

export function lerpCoordinate(
  from: InterpolatedCoordinate,
  to: InterpolatedCoordinate,
  progress: number
): InterpolatedCoordinate {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return {
    latitude: from.latitude + (to.latitude - from.latitude) * clampedProgress,
    longitude: from.longitude + (to.longitude - from.longitude) * clampedProgress,
  };
}

function getInterpolationDuration(now: number, previousTargetAt: number | null): number {
  if (previousTargetAt === null) {
    return DEFAULT_INTERPOLATION_MS;
  }

  const elapsed = now - previousTargetAt;
  return Math.max(MIN_INTERPOLATION_MS, Math.min(MAX_INTERPOLATION_MS, elapsed));
}

function haversineDistanceMeters(a: InterpolatedCoordinate, b: InterpolatedCoordinate): number {
  const R = EARTH_RADIUS_M;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLng = Math.sin(dLng / 2);
  const h =
    sinHalfDLat * sinHalfDLat +
    sinHalfDLng * sinHalfDLng * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function deadReckon(
  from: InterpolatedCoordinate,
  speedMps: number,
  headingDeg: number,
  dtSeconds: number,
): InterpolatedCoordinate {
  const headingRad = (headingDeg * Math.PI) / 180;
  const distance = speedMps * dtSeconds;
  const dLat = (distance * Math.cos(headingRad)) / EARTH_RADIUS_M;
  const dLng = (distance * Math.sin(headingRad)) / (EARTH_RADIUS_M * Math.cos((from.latitude * Math.PI) / 180));
  return {
    latitude: from.latitude + (dLat * 180) / Math.PI,
    longitude: from.longitude + (dLng * 180) / Math.PI,
  };
}

export function useInterpolatedCoordinate(
  target: InterpolatedCoordinate | null,
  speed?: number | null,
  heading?: number | null,
): InterpolatedCoordinate | null {
  const targetLatitude = target?.latitude ?? null;
  const targetLongitude = target?.longitude ?? null;
  const [displayCoordinate, setDisplayCoordinate] =
    useState<InterpolatedCoordinate | null>(target);
  const displayCoordinateRef = useRef<InterpolatedCoordinate | null>(target);
  const previousTargetAtRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  // Dead-reckoning state
  const speedRef = useRef<number | null>(null);
  const headingRef = useRef<number | null>(null);
  const lastGpsTargetRef = useRef<InterpolatedCoordinate | null>(null);
  const deadReckonStartRef = useRef<number | null>(null);
  const lastStateUpdateMsRef = useRef(0);

  // Keep speed/heading refs current without restarting interpolation
  useEffect(() => {
    speedRef.current = speed ?? null;
  }, [speed]);

  useEffect(() => {
    headingRef.current = heading ?? null;
  }, [heading]);

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      deadReckonStartRef.current = null;
    }

    const targetCoordinate =
      targetLatitude !== null && targetLongitude !== null
        ? { latitude: targetLatitude, longitude: targetLongitude }
        : null;

    if (targetCoordinate === null) {
      previousTargetAtRef.current = null;
      displayCoordinateRef.current = null;
      lastGpsTargetRef.current = null;
      frameRef.current = requestAnimationFrame(() => {
        setDisplayCoordinate(null);
        frameRef.current = null;
      });
      return () => {
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
      };
    }

    const now = Date.now();
    const from = displayCoordinateRef.current;

    // Record GPS arrival for dead-reckoning limits
    lastGpsTargetRef.current = targetCoordinate;

    if (from === null) {
      previousTargetAtRef.current = now;
      displayCoordinateRef.current = targetCoordinate;
      frameRef.current = requestAnimationFrame(() => {
        setDisplayCoordinate(targetCoordinate);
        frameRef.current = null;
      });
      return () => {
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
      };
    }

    const durationMs = getInterpolationDuration(now, previousTargetAtRef.current);
    previousTargetAtRef.current = now;
    const startTime = now;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / durationMs;

      if (progress < 1) {
        const nextCoordinate = lerpCoordinate(from, targetCoordinate, progress);
        displayCoordinateRef.current = nextCoordinate;
        const now = Date.now();
        if (now - lastStateUpdateMsRef.current >= STATE_UPDATE_THROTTLE_MS) {
          lastStateUpdateMsRef.current = now;
          setDisplayCoordinate(nextCoordinate);
        }
        frameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Interpolation complete — always commit final position
      displayCoordinateRef.current = targetCoordinate;
      setDisplayCoordinate(targetCoordinate);
      lastStateUpdateMsRef.current = Date.now();

      // Begin dead-reckoning from the target position
      const speedNow = speedRef.current;
      const headingNow = headingRef.current;
      const canReckon =
        speedNow !== null &&
        speedNow >= DEAD_RECKON_MIN_SPEED_MPS &&
        headingNow !== null &&
        Number.isFinite(headingNow);
      const gpsTarget = lastGpsTargetRef.current;

      if (!canReckon || !gpsTarget) {
        frameRef.current = null;
        return;
      }

      deadReckonStartRef.current = Date.now();

      const deadReckonTick = () => {
        const tickNow = Date.now();
        const dtSeconds = (tickNow - (deadReckonStartRef.current ?? tickNow)) / 1000;
        deadReckonStartRef.current = tickNow;

        // Check time limit since last GPS
        const prevTargetAt = previousTargetAtRef.current;
        if (prevTargetAt === null) {
          frameRef.current = null;
          return;
        }
        const timeSinceGps = tickNow - prevTargetAt;
        if (timeSinceGps > DEAD_RECKON_MAX_SECONDS * 1000) {
          frameRef.current = null;
          return;
        }

        const s = speedRef.current;
        const h = headingRef.current;
        const currentPos = displayCoordinateRef.current;

        // Stop dead-reckoning if speed drops below threshold
        if (s === null || s < DEAD_RECKON_MIN_SPEED_MPS || h === null || !Number.isFinite(h) || !currentPos) {
          frameRef.current = null;
          return;
        }

        // Extrapolate position forward
        const extrapolated = deadReckon(currentPos, s, h, dtSeconds);

        // Check distance limit from last GPS
        const drift = haversineDistanceMeters(extrapolated, lastGpsTargetRef.current ?? gpsTarget);
        if (drift > DEAD_RECKON_MAX_METERS) {
          // Drifted too far — hold at the max distance from GPS
          frameRef.current = null;
          return;
        }

        displayCoordinateRef.current = extrapolated;
        const tickNowMs = Date.now();
        if (tickNowMs - lastStateUpdateMsRef.current >= STATE_UPDATE_THROTTLE_MS) {
          lastStateUpdateMsRef.current = tickNowMs;
          setDisplayCoordinate(extrapolated);
        }
        frameRef.current = requestAnimationFrame(deadReckonTick);
      };

      frameRef.current = requestAnimationFrame(deadReckonTick);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        deadReckonStartRef.current = null;
      }
    };
  }, [targetLatitude, targetLongitude]);

  return displayCoordinate;
}
