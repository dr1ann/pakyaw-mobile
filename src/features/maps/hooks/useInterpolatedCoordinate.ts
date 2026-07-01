import { useEffect, useRef, useState } from 'react';

export type InterpolatedCoordinate = {
  readonly latitude: number;
  readonly longitude: number;
};

const DEFAULT_INTERPOLATION_MS = 1_000;
const MIN_INTERPOLATION_MS = 250;
const MAX_INTERPOLATION_MS = 2_000;

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

export function useInterpolatedCoordinate(
  target: InterpolatedCoordinate | null
): InterpolatedCoordinate | null {
  const targetLatitude = target?.latitude ?? null;
  const targetLongitude = target?.longitude ?? null;
  const [displayCoordinate, setDisplayCoordinate] =
    useState<InterpolatedCoordinate | null>(target);
  const displayCoordinateRef = useRef<InterpolatedCoordinate | null>(target);
  const previousTargetAtRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const targetCoordinate =
      targetLatitude !== null && targetLongitude !== null
        ? { latitude: targetLatitude, longitude: targetLongitude }
        : null;

    if (targetCoordinate === null) {
      previousTargetAtRef.current = null;
      displayCoordinateRef.current = null;
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

    const animate = () => {
      const progress = (Date.now() - now) / durationMs;
      const nextCoordinate = lerpCoordinate(from, targetCoordinate, progress);
      displayCoordinateRef.current = nextCoordinate;
      setDisplayCoordinate(nextCoordinate);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [targetLatitude, targetLongitude]);

  return displayCoordinate;
}
