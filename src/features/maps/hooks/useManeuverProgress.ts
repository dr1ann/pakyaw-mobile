import { useEffect, useMemo, useState } from 'react';
import { useActiveTripStore } from '@/stores/activeTripStore';
import type { NavRoute } from '../navigation/types';
import { haversineMeters } from '@/lib/geo';
import { getDistanceToStepEnd, getMinDistanceToPolyline } from '@/lib/geoProjection';

const MIN_SPEED_SAMPLES = 3;
const MAX_SPEED_SAMPLES = 8;
const MIN_RELIABLE_SPEED_MPS = 1;
const MAX_REASONABLE_SPEED_MPS = 45;

export function getRouteDurationEtaSeconds(
  remainingDistanceMeters: number,
  totalDistanceMeters: number,
  totalDurationSeconds: number
): number {
  return totalDistanceMeters > 0
    ? totalDurationSeconds * (remainingDistanceMeters / totalDistanceMeters)
    : 0;
}

export function getAverageReliableSpeed(samples: readonly number[]): number | null {
  const reliableSamples = samples.filter(
    (speed) =>
      Number.isFinite(speed) &&
      speed >= MIN_RELIABLE_SPEED_MPS &&
      speed <= MAX_REASONABLE_SPEED_MPS
  );

  if (reliableSamples.length < MIN_SPEED_SAMPLES) {
    return null;
  }

  const totalSpeed = reliableSamples.reduce((sum, speed) => sum + speed, 0);
  return totalSpeed / reliableSamples.length;
}

export function getAdaptiveEtaSeconds({
  remainingDistanceMeters,
  totalDistanceMeters,
  totalDurationSeconds,
  averageSpeedMetersPerSecond,
}: {
  readonly remainingDistanceMeters: number;
  readonly totalDistanceMeters: number;
  readonly totalDurationSeconds: number;
  readonly averageSpeedMetersPerSecond: number | null;
}): number {
  if (
    averageSpeedMetersPerSecond !== null &&
    averageSpeedMetersPerSecond >= MIN_RELIABLE_SPEED_MPS
  ) {
    return remainingDistanceMeters / averageSpeedMetersPerSecond;
  }

  return getRouteDurationEtaSeconds(
    remainingDistanceMeters,
    totalDistanceMeters,
    totalDurationSeconds
  );
}

/**
 * Hook to track local turn-by-turn step progression, remaining step distance,
 * total remaining distance, and dynamic trip ETA/arrival.
 */
export function useManeuverProgress(
  route: NavRoute | null,
  driverLocation: { latitude: number; longitude: number } | null
) {
  const navStepIndex = useActiveTripStore((s) => s.navStepIndex);
  const setNavStepIndex = useActiveTripStore((s) => s.setNavStepIndex);
  const gpsSpeed = useActiveTripStore((s) => s.gpsSpeed);
  const [speedSamples, setSpeedSamples] = useState<readonly number[]>([]);

  const steps = useMemo(() => route?.steps ?? [], [route?.steps]);

  // Reset step index when route changes
  useEffect(() => {
    setNavStepIndex(0);
  }, [route?.fetchedAt, setNavStepIndex]);

  useEffect(() => {
    const isUnreliableSpeed =
      gpsSpeed === null ||
      !Number.isFinite(gpsSpeed) ||
      gpsSpeed < MIN_RELIABLE_SPEED_MPS ||
      gpsSpeed > MAX_REASONABLE_SPEED_MPS;

    if (isUnreliableSpeed) {
      const frame = requestAnimationFrame(() => {
        setSpeedSamples((samples) => (samples.length === 0 ? samples : []));
      });

      return () => cancelAnimationFrame(frame);
    }

    const frame = requestAnimationFrame(() => {
      setSpeedSamples((samples) => [...samples, gpsSpeed].slice(-MAX_SPEED_SAMPLES));
    });

    return () => cancelAnimationFrame(frame);
  }, [gpsSpeed]);

  const averageSpeedMetersPerSecond = useMemo(
    () => getAverageReliableSpeed(speedSamples),
    [speedSamples]
  );

  // Advance step index based on driver location relative to current and next steps
  useEffect(() => {
    if (!route || steps.length === 0 || !driverLocation) {
      return;
    }

    const driverPos = { lat: driverLocation.latitude, lng: driverLocation.longitude };
    const currentStepIndex = navStepIndex;

    if (currentStepIndex < steps.length - 1) {
      const currentStep = steps[currentStepIndex];
      const nextStep = steps[currentStepIndex + 1];

      // Distance to next step's start (end of current step)
      const distToNextEnd = haversineMeters(driverPos, nextStep.startLocation);

      // Distances to current vs next step polyline geometries
      const distToCurrentPolyline = getMinDistanceToPolyline(driverPos, currentStep.polyline);
      const distToNextPolyline = getMinDistanceToPolyline(driverPos, nextStep.polyline);

      // Advance if within 25m of next step start, or if closer to next step geometry
      if (distToNextEnd < 25 || distToNextPolyline < distToCurrentPolyline) {
        setNavStepIndex(currentStepIndex + 1);
      }
    }
  }, [driverLocation, route, steps, navStepIndex, setNavStepIndex]);

  // Compute remaining distances and trip statistics
  const stats = useMemo(() => {
    if (!route || steps.length === 0 || !driverLocation) {
      return {
        distanceToManeuver: 0,
        remainingDistanceMeters: 0,
        etaSeconds: 0,
      };
    }

    const driverPos = { lat: driverLocation.latitude, lng: driverLocation.longitude };
    const currentStepIndex = Math.min(navStepIndex, steps.length - 1);
    const currentStep = steps[currentStepIndex];

    // Distance from driver position to next maneuver (end of current step)
    const distanceToManeuver = getDistanceToStepEnd(driverPos, currentStep);

    // Total remaining trip distance is the remaining portion of the current step
    // plus all subsequent steps in the route.
    let remainingDistanceMeters = distanceToManeuver;
    for (let i = currentStepIndex + 1; i < steps.length; i++) {
      remainingDistanceMeters += steps[i].distanceMeters;
    }

    const totalDistance = route.distanceMeters;
    const totalDuration = route.durationSeconds;
    const etaSeconds = getAdaptiveEtaSeconds({
      remainingDistanceMeters,
      totalDistanceMeters: totalDistance,
      totalDurationSeconds: totalDuration,
      averageSpeedMetersPerSecond,
    });

    return {
      distanceToManeuver,
      remainingDistanceMeters,
      etaSeconds,
    };
  }, [route, steps, driverLocation, navStepIndex, averageSpeedMetersPerSecond]);

  return stats;
}
