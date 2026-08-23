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

function getDeviceMotion(): DeviceMotionType | null {
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
    // expo-sensors failed to load despite native module being present
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

const GYRO_COMPLEMENTARY_ALPHA = 0.98;
const GYRO_MAX_DRIFT_SECONDS = 10;
const GYRO_UPDATE_INTERVAL_MS = 100; // 10fps sensor rate (was 60fps — caused ANR)
const GYRO_STATE_THROTTLE_MS = 80;   // min ms between gyro-driven state updates

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

  // Refs for gyro callback (avoids stale closure)
  const gpsHeadingRef = useRef<number | null>(null);
  const gpsSpeedRef = useRef<number | null>(null);

  useEffect(() => {
    gpsHeadingRef.current = gpsHeading;
    gpsSpeedRef.current = gpsSpeed;
  }, [gpsHeading, gpsSpeed]);

  // Gyroscope state
  const gyroAvailableRef = useRef(false);
  const gyroHeadingRef = useRef<number | null>(null);
  const gyroLastTimestampRef = useRef<number | null>(null);
  const gyroLastGpsAnchorRef = useRef<number | null>(null);
  const gyroLastStateUpdateMsRef = useRef(0);

  const isNavActive = isNavActiveStatus(status);

  // ──────────────────────────────────────────────────────────────
  // Fusion and smoothing
  //
  // Two modes:
  //   arrowOnly=true  — called from gyro callback at ~10fps.
  //                     Only updates arrowRotation (marker).
  //                     Camera navHeading is NOT touched.
  //   arrowOnly=false — called from GPS/route/magnetometer effects.
  //                     Updates navHeading (camera) with adaptive smoothing.
  //                     Also updates arrowRotation ONLY when gyro is NOT
  //                     active (gyro owns the marker when available).
  // ──────────────────────────────────────────────────────────────
  const fuseAndSmooth = (options?: { arrowOnly?: boolean }) => {
    const arrowOnly = options?.arrowOnly ?? false;
    const gyroActive = gyroAvailableRef.current && gyroHeadingRef.current !== null;
    const rb = routeBearingRef.current;

    if (arrowOnly) {
      // ── Gyro path: marker only ──
      const markerSource = selectHeadingSource({
        previousSource: headingSourceRef.current,
        gpsHeading,
        gpsSpeed,
        hasCompassHeading: latestMagnetometerHeadingRef.current !== null,
        compassEnabled,
        hasRouteBearing: rb !== null && Number.isFinite(rb),
        hasGyro: gyroActive,
      });

      let sourceHeading: number | null = null;
      if (markerSource === 'gyro') {
        sourceHeading = gyroHeadingRef.current;
      } else if (markerSource === 'gps') {
        sourceHeading = gpsHeading;
      } else if (markerSource === 'compass') {
        sourceHeading = latestMagnetometerHeadingRef.current;
      } else if (markerSource === 'route') {
        sourceHeading = rb;
      }

      if (sourceHeading === null) return;

      // Light smoothing for the marker — responsive but not jittery
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
      return;
    }

    // ── GPS/route path: camera heading (+ marker if no gyro) ──
    // Camera NEVER uses gyro — stays on GPS/rate with adaptive smoothing
    const cameraSource = selectHeadingSource({
      previousSource: headingSourceRef.current,
      gpsHeading,
      gpsSpeed,
      hasCompassHeading: latestMagnetometerHeadingRef.current !== null,
      compassEnabled,
      hasRouteBearing: rb !== null && Number.isFinite(rb),
      hasGyro: false, // camera always uses GPS/compass/route, never gyro
    });

    headingSourceRef.current = cameraSource;

    let cameraHeading: number | null = null;
    switch (cameraSource) {
      case 'gps':
        cameraHeading = gpsHeading;
        break;
      case 'compass':
        cameraHeading = latestMagnetometerHeadingRef.current;
        break;
      case 'route':
        cameraHeading = rb;
        break;
      default:
        cameraHeading = null;
    }

    if (cameraHeading === null) {
      setNavHeading(null);
      if (!gyroActive) {
        setArrowRotation(null);
      }
      return;
    }

    // Detect position corrections: if the GPS/route heading differs from the
    // gyro heading by more than 30°, the gyro was likely initialized from a
    // stale GPS fix (common on mobile data after a cold start). Snap the gyro
    // and arrow rotation to the new heading instead of waiting for the slow
    // complementary filter (2% per sample = ~50s to correct a 90° error).
    if (gyroActive && gyroHeadingRef.current !== null) {
      let gyroDelta = Math.abs(cameraHeading - gyroHeadingRef.current);
      if (gyroDelta > 180) gyroDelta = 360 - gyroDelta;
      if (gyroDelta > 30) {
        gyroHeadingRef.current = cameraHeading;
        gyroLastGpsAnchorRef.current = Date.now();
        arrowRotationRef.current = cameraHeading;
        setArrowRotation(cameraHeading);
      }
    }

    // Update camera heading with adaptive low-pass smoothing
    if (smoothedHeadingRef.current === null) {
      smoothedHeadingRef.current = cameraHeading;
    } else {
      const prev = smoothedHeadingRef.current;
      const curr = cameraHeading;
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
    setNavHeading(smoothedHeadingRef.current);

    // Update marker rotation ONLY when gyro is not active.
    // When gyro is active, it owns the marker at 10fps.
    if (!gyroActive) {
      if (arrowRotationRef.current === null) {
        arrowRotationRef.current = cameraHeading;
      } else {
        const prev = arrowRotationRef.current;
        const curr = cameraHeading;
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
    }
  };

  // ──────────────────────────────────────────────────────────────
  // DeviceMotion (gyroscope) subscription — marker only, throttled
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNavActive) {
      gyroAvailableRef.current = false;
      gyroHeadingRef.current = null;
      gyroLastTimestampRef.current = null;
      gyroLastGpsAnchorRef.current = null;
      gyroLastStateUpdateMsRef.current = 0;
      return;
    }

    let subscription: { remove: () => void } | null = null;
    let active = true;

    async function initGyro() {
      try {
        const DeviceMotion = getDeviceMotion();
        if (!DeviceMotion) {
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

        await DeviceMotion.setUpdateInterval(GYRO_UPDATE_INTERVAL_MS);

        subscription = DeviceMotion.addListener((data) => {
          if (!active) return;

          const { rotationRate } = data;
          const rate = rotationRate?.alpha ?? rotationRate?.beta ?? rotationRate?.gamma ?? 0;

          const now = Date.now();
          const dtSeconds =
            gyroLastTimestampRef.current !== null
              ? (now - gyroLastTimestampRef.current) / 1000
              : 0;
          gyroLastTimestampRef.current = now;

          const deltaDeg = (rate * 180) / Math.PI * dtSeconds;

          if (gyroHeadingRef.current === null) {
            const curGpsH = gpsHeadingRef.current;
            const curGpsS = gpsSpeedRef.current;
            const gpsAvailable = hasGpsCourse(curGpsH, curGpsS) && curGpsS !== null && curGpsS >= HEADING_SPEED_THRESHOLD_MS;
            if (gpsAvailable && curGpsH !== null) {
              gyroHeadingRef.current = curGpsH;
              gyroLastGpsAnchorRef.current = now;
            } else if (smoothedHeadingRef.current !== null) {
              gyroHeadingRef.current = smoothedHeadingRef.current;
            } else {
              return;
            }
          }

          // Complementary filter with GPS when available
          const curGpsH2 = gpsHeadingRef.current;
          const curGpsS2 = gpsSpeedRef.current;
          const hasGps = hasGpsCourse(curGpsH2, curGpsS2) && curGpsS2 !== null && curGpsS2 >= HEADING_SPEED_THRESHOLD_MS;
          if (hasGps && curGpsH2 !== null) {
            gyroLastGpsAnchorRef.current = now;
            const prev = gyroHeadingRef.current!;

            // If GPS heading differs from gyro by >30°, snap instead of
            // using the slow complementary filter. This handles position
            // corrections (stale GPS → fresh GPS) where the gyro was
            // initialized from a wrong heading and would take ~50s to
            // correct at 2% per sample.
            let gpsDelta = Math.abs(curGpsH2 - prev);
            if (gpsDelta > 180) gpsDelta = 360 - gpsDelta;

            if (gpsDelta > 30) {
              gyroHeadingRef.current = curGpsH2;
            } else {
              const sign = ((curGpsH2 - prev + 540) % 360) - 180;
              const corrected = prev + sign * (1 - GYRO_COMPLEMENTARY_ALPHA) + deltaDeg;
              gyroHeadingRef.current = ((corrected % 360) + 360) % 360;
            }
          } else {
            const timeSinceGps =
              gyroLastGpsAnchorRef.current !== null
                ? (now - gyroLastGpsAnchorRef.current) / 1000
                : Infinity;
            if (timeSinceGps <= GYRO_MAX_DRIFT_SECONDS) {
              gyroHeadingRef.current = ((gyroHeadingRef.current! + deltaDeg) % 360 + 360) % 360;
            }
          }

          if (gyroHeadingRef.current === null) {
            gyroAvailableRef.current = false;
            return;
          }
          gyroAvailableRef.current = true;

          // Throttle state updates to prevent ANR — max ~12fps
          if (now - gyroLastStateUpdateMsRef.current < GYRO_STATE_THROTTLE_MS) {
            return;
          }
          gyroLastStateUpdateMsRef.current = now;

          // Gyro only updates the marker, NOT the camera
          fuseAndSmooth({ arrowOnly: true });
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

  // GPS / route bearing updates — drives camera heading at GPS rate (1s)
  useEffect(() => {
    routeBearingRef.current = routeBearing;
    if (isNavActive) {
      fuseAndSmooth();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsHeading, gpsSpeed, routeBearing, isNavActive]);
}
