import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { logger } from '@pakyaw/shared/lib/logger';
import {
  HEADING_GPS_COURSE_DISABLE_SPEED_MS,
  HEADING_SPEED_THRESHOLD_MS,
} from '@pakyaw/shared/features/maps/navigation/constants';
import { isNavActiveStatus } from '@pakyaw/shared/features/maps/navigation/navigationHelper';

const SMOOTHING_FACTOR = 0.25; // Shortest-arc low-pass smoothing factor
export type HeadingSource = 'gps' | 'compass' | 'route' | null;

type HeadingSourceParams = {
  previousSource: HeadingSource;
  gpsHeading: number | null;
  gpsSpeed: number | null;
  hasCompassHeading: boolean;
  compassEnabled: boolean;
  hasRouteBearing: boolean;
};

function hasGpsCourse(
  gpsHeading: number | null,
  gpsSpeed: number | null,
): gpsHeading is number {
  return (
    gpsHeading !== null &&
    gpsHeading !== -1 &&
    Number.isFinite(gpsHeading) &&
    gpsSpeed !== null &&
    Number.isFinite(gpsSpeed)
  );
}

/**
 * Selects the heading source for the driver's forward-facing icon.
 *
 * Behavior (Google Maps parity):
 * - Default: GPS Course (course over ground) whenever the driver is moving
 *   above the enter threshold. Stays engaged until speed drops below the
 *   lower release threshold (hysteresis) to avoid flapping around traffic
 *   lights or stop-and-go traffic.
 * - When compassEnabled is true (user has explicitly opted into "compass
 *   mode"), the magnetometer heading takes over as the low-speed fallback.
 * - When compassEnabled is false and the vehicle is stationary, we fall
 *   back to the route bearing at the current position (if available) so
 *   the arrow keeps pointing down the road rather than freezing in the
 *   last known heading.
 * - If no source is available, returns null — callers keep the previous
 *   smoothed value rather than snapping to 0°.
 */
export function selectHeadingSource({
  previousSource,
  gpsHeading,
  gpsSpeed,
  hasCompassHeading,
  compassEnabled,
  hasRouteBearing,
}: HeadingSourceParams): HeadingSource {
  const gpsEnterSpeed =
    previousSource === 'gps'
      ? HEADING_GPS_COURSE_DISABLE_SPEED_MS
      : HEADING_SPEED_THRESHOLD_MS;

  if (
    hasGpsCourse(gpsHeading, gpsSpeed) &&
    gpsSpeed !== null &&
    gpsSpeed >= gpsEnterSpeed
  ) {
    return 'gps';
  }

  if (compassEnabled && hasCompassHeading) {
    return 'compass';
  }

  if (hasRouteBearing) {
    return 'route';
  }

  return null;
}

/**
 * Hook to fuse and smooth heading for the driver's marker + navigation camera.
 *
 * Sources, in priority order:
 *   1. GPS Course (course over ground) while moving. Preferred because it
 *      reflects the actual direction of travel, not device orientation.
 *   2. Magnetometer heading, only when the user has enabled Compass Mode.
 *   3. Route bearing at the driver's current polyline position, as a
 *      stationary fallback (matches Google Maps behavior when GPS is idle).
 *
 * The magnetometer subscription is only started when compassEnabled is true,
 * so drivers on the default (GPS-first) setting don't pay the battery cost.
 */
type UseDriverHeadingParams = {
  readonly routeBearing?: number | null;
};

export function useDriverHeading(
  status: string | null,
  params?: UseDriverHeadingParams,
): void {
  const gpsHeading = useActiveTripStore((s) => s.gpsHeading);
  const gpsSpeed = useActiveTripStore((s) => s.gpsSpeed);
  const compassEnabled = useActiveTripStore((s) => s.compassEnabled);
  const setNavHeading = useActiveTripStore((s) => s.setNavHeading);

  const routeBearing = params?.routeBearing ?? null;

  const latestMagnetometerHeadingRef = useRef<number | null>(null);
  const smoothedHeadingRef = useRef<number | null>(null);
  const headingSourceRef = useRef<HeadingSource>(null);
  const routeBearingRef = useRef<number | null>(null);

  const isNavActive = isNavActiveStatus(status);

  // Fusion and low-pass unit-vector smoothing. Called from three places:
  // the magnetometer callback (when subscribed), the GPS-effect below (when
  // gpsHeading/gpsSpeed change), and once on route-bearing changes so a fresh
  // stationary bearing seeds the marker immediately after a reroute.
  const fuseAndSmooth = () => {
    const rb = routeBearingRef.current;
    const headingSource = selectHeadingSource({
      previousSource: headingSourceRef.current,
      gpsHeading,
      gpsSpeed,
      hasCompassHeading: latestMagnetometerHeadingRef.current !== null,
      compassEnabled,
      hasRouteBearing: rb !== null && Number.isFinite(rb),
    });

    headingSourceRef.current = headingSource;

    let sourceHeading: number | null;
    switch (headingSource) {
      case 'gps':
        sourceHeading = gpsHeading;
        break;
      case 'compass':
        sourceHeading = latestMagnetometerHeadingRef.current;
        break;
      case 'route':
        sourceHeading = rb;
        break;
      default:
        sourceHeading = null;
    }

    if (sourceHeading === null) {
      // No heading source available — push null so the camera/arrow doesn't
      // freeze at the last smoothed value (e.g. stale compass angle after
      // Compass Mode is toggled off while stationary).
      setNavHeading(null);
      return;
    }

    if (smoothedHeadingRef.current === null) {
      // First frame — publish the raw source immediately so the camera has a
      // heading the moment Navigation Mode engages, instead of waiting a full
      // smoothing period. Without this the arrow / camera stays null-heading
      // until the second GPS or compass sample arrives.
      smoothedHeadingRef.current = sourceHeading;
    } else {
      const prev = smoothedHeadingRef.current;
      const curr = sourceHeading;

      // Convert angles to unit vectors (prevents wrapping interpolation jumps at 0/360)
      const prevRad = (prev * Math.PI) / 180;
      const currRad = (curr * Math.PI) / 180;

      const prevX = Math.cos(prevRad);
      const prevY = Math.sin(prevRad);
      const currX = Math.cos(currRad);
      const currY = Math.sin(currRad);

      // Low pass filter
      const nextX = prevX + SMOOTHING_FACTOR * (currX - prevX);
      const nextY = prevY + SMOOTHING_FACTOR * (currY - prevY);

      let nextHeading = (Math.atan2(nextY, nextX) * 180) / Math.PI;
      if (nextHeading < 0) {
        nextHeading += 360;
      }
      smoothedHeadingRef.current = nextHeading;
    }

    setNavHeading(smoothedHeadingRef.current);
  };

  // Magnetometer subscription — only when the user has explicitly enabled
  // Compass Mode. Otherwise the magnetometer stays off entirely (battery win,
  // no jitter, no indoor-metal drift feeding into the smoother).
  useEffect(() => {
    if (!isNavActive) {
      latestMagnetometerHeadingRef.current = null;
      smoothedHeadingRef.current = null;
      headingSourceRef.current = null;
      setNavHeading(null);
      return;
    }

    if (!compassEnabled) {
      // Compass Mode is off — release cached magnetometer sample AND reset
      // the smoothed heading so the pipeline doesn't retain the last compass
      // angle. Without this, toggling Compass OFF while stationary (no GPS
      // course, no route bearing) would freeze the arrow at the previous
      // compass heading.
      latestMagnetometerHeadingRef.current = null;
      smoothedHeadingRef.current = null;
      headingSourceRef.current = null;
      fuseAndSmooth();
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let active = true;

    async function startHeading() {
      try {
        subscription = await Location.watchHeadingAsync((data) => {
          if (!active) return;
          const headingVal = data.trueHeading !== -1 ? data.trueHeading : data.magHeading;
          latestMagnetometerHeadingRef.current = headingVal;
          fuseAndSmooth();
        });
      } catch (err) {
        logger.error('[useDriverHeading] Failed to watch heading', { error: err });
      }
    }

    void startHeading();

    return () => {
      active = false;
      if (subscription) {
        subscription.remove();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavActive, compassEnabled]);

  // Run fusion when raw GPS telemetry or the route bearing updates. The
  // routeBearingRef is refreshed here (inside an effect, not during render)
  // so `fuseAndSmooth` — which is also called from the magnetometer callback
  // and can outlive the current render — always reads the latest value.
  useEffect(() => {
    routeBearingRef.current = routeBearing;
    if (isNavActive) {
      fuseAndSmooth();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsHeading, gpsSpeed, routeBearing, isNavActive]);
}
