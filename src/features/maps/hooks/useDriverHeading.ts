import {
  HEADING_GPS_COURSE_DISABLE_SPEED_MS,
  HEADING_SPEED_THRESHOLD_MS,
} from '@pakyaw/shared/features/maps/navigation/constants';
import { isNavActiveStatus } from '@pakyaw/shared/features/maps/navigation/navigationHelper';
import { logger } from '@pakyaw/shared/lib/logger';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import * as Location from 'expo-location';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useRef } from 'react';

type DeviceMotionType = {
  isAvailableAsync: () => Promise<boolean>;
  setUpdateInterval: (intervalMs: number) => Promise<void> | void;
  addListener: (listener: (data: { rotationRate?: { alpha?: number; beta?: number; gamma?: number } | null }) => void) => { remove: () => void };
};

/**
 * Safely loads DeviceMotion from expo-sensors only if the underlying
 * ExponentDeviceMotion native module is present in the current binary.
 *
 * expo-sensors eagerly calls requireNativeModule('ExponentDeviceMotion') at
 * module evaluation time, which throws a hard error in dev-client builds
 * that were not compiled with expo-sensors native code.
 *
 * By probing via requireOptionalNativeModule first (which returns null instead
 * of throwing), we avoid any module-evaluation crash and fall back gracefully
 * to GPS-only heading when the sensor is unavailable.
 */
function getDeviceMotion(): DeviceMotionType | null {
  // Probe native layer — returns null instead of throwing when absent
  const nativeModule = requireOptionalNativeModule('ExponentDeviceMotion');
  if (!nativeModule) {
    return null;
  }

  try {
    const { DeviceMotion } = require('expo-sensors') as { DeviceMotion: DeviceMotionType };
    if (DeviceMotion && typeof DeviceMotion.isAvailableAsync === 'function') {
      return DeviceMotion;
    }
  } catch {
    // expo-sensors failed to load despite native module being present — skip gyro
  }
  return null;
}

const BASE_SMOOTHING_FACTOR = 0.25;
const TURN_SMOOTHING_FACTOR = 0.65;
const UTURN_SMOOTHING_FACTOR = 0.92;
const TURN_SMOOTHING_THRESHOLD_DEG = 25;
const UTURN_SMOOTHING_THRESHOLD_DEG = 140;
const STABILIZE_THRESHOLD_DEG = 5;
const STABILIZE_SAMPLE_COUNT = 3;

// Gyroscope complementary filter constants
const GYRO_COMPLEMENTARY_ALPHA = 0.98; // 98% gyro, 2% GPS for drift correction
const GYRO_MAX_DRIFT_SECONDS = 10;     // max time without GPS anchor before freezing
const GYRO_UPDATE_INTERVAL_MS = 16;    // ~60fps update rate

export type HeadingSource = 'gyro' | 'gps' | 'compass' | 'route' | null;

type HeadingSourceParams = {
  previousSource: HeadingSource;
  gpsHeading: number | null;
  gpsSpeed: number | null;
  hasCompassHeading: boolean;
  compassEnabled: boolean;
  hasRouteBearing: boolean;
  hasGyro: boolean;
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

export function selectHeadingSource({
  previousSource,
  gpsHeading,
  gpsSpeed,
  hasCompassHeading,
  compassEnabled,
  hasRouteBearing,
  hasGyro,
}: HeadingSourceParams): HeadingSource {
  const gpsEnterSpeed =
    previousSource === 'gps'
      ? HEADING_GPS_COURSE_DISABLE_SPEED_MS
      : HEADING_SPEED_THRESHOLD_MS;

  // Gyro is the preferred source — it gives instant heading response
  if (hasGyro) {
    return 'gyro';
  }

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
  const setArrowRotation = useActiveTripStore((s) => s.setArrowRotation);

  const routeBearing = params?.routeBearing ?? null;

  const latestMagnetometerHeadingRef = useRef<number | null>(null);
  const smoothedHeadingRef = useRef<number | null>(null);
  const headingSourceRef = useRef<HeadingSource>(null);
  const routeBearingRef = useRef<number | null>(null);
  const arrowRotationRef = useRef<number | null>(null);
  const currentSmoothingFactorRef = useRef(BASE_SMOOTHING_FACTOR);
  const stabilizeCountRef = useRef(0);

  // GPS/heading refs for the gyro callback (avoids stale closure)
  const gpsHeadingRef = useRef<number | null>(null);
  const gpsSpeedRef = useRef<number | null>(null);
  const smoothedHeadingRefForGyro = useRef<number | null>(null);

  // Keep refs current (these run synchronously in render)
  gpsHeadingRef.current = gpsHeading;
  gpsSpeedRef.current = gpsSpeed;
  smoothedHeadingRefForGyro.current = smoothedHeadingRef.current;

  // Gyroscope state
  const gyroAvailableRef = useRef(false);
  const gyroHeadingRef = useRef<number | null>(null);
  const gyroLastTimestampRef = useRef<number | null>(null);
  const gyroLastGpsAnchorRef = useRef<number | null>(null);
  const gyroLastGpsHeadingRef = useRef<number | null>(null);

  const isNavActive = isNavActiveStatus(status);

  // ──────────────────────────────────────────────────────────────
  // Fusion and smoothing — runs on every heading source update
  // ──────────────────────────────────────────────────────────────
  const fuseAndSmooth = () => {
    const rb = routeBearingRef.current;
    const headingSource = selectHeadingSource({
      previousSource: headingSourceRef.current,
      gpsHeading,
      gpsSpeed,
      hasCompassHeading: latestMagnetometerHeadingRef.current !== null,
      compassEnabled,
      hasRouteBearing: rb !== null && Number.isFinite(rb),
      hasGyro: gyroAvailableRef.current && gyroHeadingRef.current !== null,
    });

    headingSourceRef.current = headingSource;

    let sourceHeading: number | null;
    switch (headingSource) {
      case 'gyro':
        sourceHeading = gyroHeadingRef.current;
        break;
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
      setNavHeading(null);
      setArrowRotation(null);
      return;
    }

    // Arrow rotation: instant light smoothing for the marker
    if (arrowRotationRef.current === null) {
      arrowRotationRef.current = sourceHeading;
    } else {
      const prev = arrowRotationRef.current;
      const curr = sourceHeading;
      const delta = Math.abs(curr - prev);
      const shortestDelta = delta > 180 ? 360 - delta : delta;
      const sign = ((curr - prev + 540) % 360) - 180;
      const arrowFactor = shortestDelta > 30 ? 0.85 : 0.7;

      let next = prev + sign * arrowFactor;
      if (next < 0) next += 360;
      if (next >= 360) next -= 360;
      arrowRotationRef.current = next;
    }
    setArrowRotation(arrowRotationRef.current);

    if (smoothedHeadingRef.current === null) {
      smoothedHeadingRef.current = sourceHeading;
    } else {
      // When gyro is the source, apply complementary filter (98% gyro, 2% GPS)
      // instead of the adaptive low-pass — gyro already provides smooth output
      if (headingSource === 'gyro') {
        const prev = smoothedHeadingRef.current;
        const curr = sourceHeading;
        const sign = ((curr - prev + 540) % 360) - 180;
        const delta = sign;
        const corrected = prev + delta * (1 - GYRO_COMPLEMENTARY_ALPHA);

        let nextHeading = ((corrected % 360) + 360) % 360;
        smoothedHeadingRef.current = nextHeading;
      } else {
        // No gyro available — use adaptive low-pass smoothing on the raw source
        const prev = smoothedHeadingRef.current;
        const curr = sourceHeading;

        const delta = Math.abs(curr - prev);
        const shortestDelta = delta > 180 ? 360 - delta : delta;

        if (shortestDelta > UTURN_SMOOTHING_THRESHOLD_DEG) {
          currentSmoothingFactorRef.current = UTURN_SMOOTHING_FACTOR;
          stabilizeCountRef.current = 0;
        } else if (shortestDelta > TURN_SMOOTHING_THRESHOLD_DEG) {
          currentSmoothingFactorRef.current = TURN_SMOOTHING_FACTOR;
          stabilizeCountRef.current = 0;
        } else if (shortestDelta <= STABILIZE_THRESHOLD_DEG) {
          stabilizeCountRef.current += 1;
          if (stabilizeCountRef.current >= STABILIZE_SAMPLE_COUNT) {
            currentSmoothingFactorRef.current = BASE_SMOOTHING_FACTOR;
          }
        } else {
          stabilizeCountRef.current = Math.max(0, stabilizeCountRef.current);
        }

        const smoothingFactor = currentSmoothingFactorRef.current;

        const prevRad = (prev * Math.PI) / 180;
        const currRad = (curr * Math.PI) / 180;

        const prevX = Math.cos(prevRad);
        const prevY = Math.sin(prevRad);
        const currX = Math.cos(currRad);
        const currY = Math.sin(currRad);

        const nextX = prevX + smoothingFactor * (currX - prevX);
        const nextY = prevY + smoothingFactor * (currY - prevY);

        let nextHeading = (Math.atan2(nextY, nextX) * 180) / Math.PI;
        if (nextHeading < 0) nextHeading += 360;
        smoothedHeadingRef.current = nextHeading;
      }
    }

    setNavHeading(smoothedHeadingRef.current);
  };

  // ──────────────────────────────────────────────────────────────
  // DeviceMotion (gyroscope) subscription
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNavActive) {
      gyroAvailableRef.current = false;
      gyroHeadingRef.current = null;
      gyroLastTimestampRef.current = null;
      gyroLastGpsAnchorRef.current = null;
      gyroLastGpsHeadingRef.current = null;
      return;
    }

    let subscription: { remove: () => void } | null = null;
    let active = true;

    async function initGyro() {
      try {
        const DeviceMotion = getDeviceMotion();
        if (!DeviceMotion || typeof DeviceMotion.isAvailableAsync !== 'function') {
          logger.info('[useDriverHeading] DeviceMotion not available in environment, using GPS-only heading');
          gyroAvailableRef.current = false;
          return;
        }

        const available = await DeviceMotion.isAvailableAsync();
        if (!available) {
          logger.info('[useDriverHeading] DeviceMotion not available, using GPS-only heading');
          gyroAvailableRef.current = false;
          return;
        }

        // Set update interval to ~60fps
        await DeviceMotion.setUpdateInterval(GYRO_UPDATE_INTERVAL_MS);

        subscription = DeviceMotion.addListener((data) => {
          if (!active) return;

          const { rotationRate } = data;
          // Use rotation around the z-axis (yaw) — the device's vertical axis
          // rotationGamma could also work but z-axis is the most direct for yaw
          // We want rotationRate.alpha (around z-axis, device flat on dash)
          // or rotationRate.gamma depending on device orientation
          // Use the largest available rotation rate component as a heuristic
          const rate =
            rotationRate?.alpha ??
            rotationRate?.beta ??
            rotationRate?.gamma ??
            0;

          const now = Date.now();
          const dtSeconds =
            gyroLastTimestampRef.current !== null
              ? (now - gyroLastTimestampRef.current) / 1000
              : 0;
          gyroLastTimestampRef.current = now;

          // Integrate rotation rate to get heading change (rate is in rad/s)
          const deltaDeg = (rate * 180) / Math.PI * dtSeconds;

          if (gyroHeadingRef.current === null) {
            // Initialize from GPS or route bearing
            const curGpsH = gpsHeadingRef.current;
            const curGpsS = gpsSpeedRef.current;
            const gpsAvailable = hasGpsCourse(curGpsH, curGpsS) && curGpsS !== null && curGpsS >= HEADING_SPEED_THRESHOLD_MS;
            if (gpsAvailable && curGpsH !== null) {
              gyroHeadingRef.current = curGpsH;
              gyroLastGpsAnchorRef.current = now;
              gyroLastGpsHeadingRef.current = curGpsH;
            } else if (smoothedHeadingRefForGyro.current !== null) {
              gyroHeadingRef.current = smoothedHeadingRefForGyro.current;
            } else {
              return; // No initialization source yet
            }
          }

          // Apply complementary filter with GPS when available
          const curGpsH2 = gpsHeadingRef.current;
          const curGpsS2 = gpsSpeedRef.current;
          const hasGps = hasGpsCourse(curGpsH2, curGpsS2) && curGpsS2 !== null && curGpsS2 >= HEADING_SPEED_THRESHOLD_MS;
          if (hasGps && curGpsH2 !== null) {
            // Anchored: complementary filter (98% gyro, 2% GPS)
            gyroLastGpsAnchorRef.current = now;
            gyroLastGpsHeadingRef.current = curGpsH2;

            const prev = gyroHeadingRef.current!;
            const sign = ((curGpsH2 - prev + 540) % 360) - 180;
            const corrected = prev + sign * (1 - GYRO_COMPLEMENTARY_ALPHA) + deltaDeg;
            gyroHeadingRef.current = ((corrected % 360) + 360) % 360;
          } else {
            // No GPS — pure gyro integration, but check drift limits
            const timeSinceGps =
              gyroLastGpsAnchorRef.current !== null
                ? (now - gyroLastGpsAnchorRef.current) / 1000
                : Infinity;

            if (timeSinceGps <= GYRO_MAX_DRIFT_SECONDS) {
              // Safe to drift — integrate rotation rate
              gyroHeadingRef.current = ((gyroHeadingRef.current! + deltaDeg) % 360 + 360) % 360;
            }
            // Otherwise: hold at last anchored position, don't drift further
          }

          // Update heading source with gyro value
          if (gyroHeadingRef.current !== null) {
            gyroAvailableRef.current = true;
            fuseAndSmooth();
          } else {
            gyroAvailableRef.current = false;
          }
        });

        logger.info('[useDriverHeading] DeviceMotion gyroscope started');
      } catch (err) {
        logger.info('[useDriverHeading] DeviceMotion init failed, falling back to GPS-only', {
          error: err instanceof Error ? err.message : String(err),
        });
        gyroAvailableRef.current = false;
      }
    }

    void initGyro();

    return () => {
      active = false;
      if (subscription) {
        subscription.remove();
        logger.info('[useDriverHeading] DeviceMotion gyroscope stopped');
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavActive]);

  // Magnetometer subscription
  useEffect(() => {
    if (!isNavActive) {
      latestMagnetometerHeadingRef.current = null;
      smoothedHeadingRef.current = null;
      arrowRotationRef.current = null;
      headingSourceRef.current = null;
      currentSmoothingFactorRef.current = BASE_SMOOTHING_FACTOR;
      stabilizeCountRef.current = 0;
      setNavHeading(null);
      setArrowRotation(null);
      return;
    }

    if (!compassEnabled) {
      latestMagnetometerHeadingRef.current = null;
      smoothedHeadingRef.current = null;
      arrowRotationRef.current = null;
      headingSourceRef.current = null;
      currentSmoothingFactorRef.current = BASE_SMOOTHING_FACTOR;
      stabilizeCountRef.current = 0;
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

  // GPS / route bearing updates
  useEffect(() => {
    routeBearingRef.current = routeBearing;
    if (isNavActive) {
      fuseAndSmooth();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsHeading, gpsSpeed, routeBearing, isNavActive]);
}
