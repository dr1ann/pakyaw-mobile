import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useActiveTripStore } from '@/stores/activeTripStore';
import { logger } from '@/lib/logger';
import { HEADING_SPEED_THRESHOLD_MS } from '../navigation/constants';
import { isNavActiveStatus } from '../navigation/navigationHelper';

const SMOOTHING_FACTOR = 0.25; // Shortest-arc low-pass smoothing factor

/**
 * Hook to fuse and smooth device magnetometer heading with GPS course heading.
 * Subscribes to the magnetometer only during active navigation phases to save battery.
 */
export function useDriverHeading(status: string | null) {
  const gpsHeading = useActiveTripStore((s) => s.gpsHeading);
  const gpsSpeed = useActiveTripStore((s) => s.gpsSpeed);
  const setNavHeading = useActiveTripStore((s) => s.setNavHeading);
  
  const latestMagnetometerHeadingRef = useRef<number | null>(null);
  const smoothedHeadingRef = useRef<number | null>(null);

  const isNavActive = isNavActiveStatus(status);

  // Fusion and Low-pass Unit Vector Smoothing
  const fuseAndSmooth = () => {
    let sourceHeading: number | null = null;

    if (
      gpsSpeed !== null &&
      gpsSpeed >= HEADING_SPEED_THRESHOLD_MS &&
      gpsHeading !== null &&
      gpsHeading !== -1
    ) {
      sourceHeading = gpsHeading;
    } else if (latestMagnetometerHeadingRef.current !== null) {
      sourceHeading = latestMagnetometerHeadingRef.current;
    }

    if (sourceHeading === null) {
      return;
    }

    if (smoothedHeadingRef.current === null) {
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

  // Subscribe to magnetometer/compass heading
  useEffect(() => {
    if (!isNavActive) {
      latestMagnetometerHeadingRef.current = null;
      smoothedHeadingRef.current = null;
      setNavHeading(null);
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
        logger.error('[useDriverHeading] Failed to watch heading', err);
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
  }, [isNavActive]);

  // Run fusion when raw GPS telemetry updates
  useEffect(() => {
    if (isNavActive) {
      fuseAndSmooth();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsHeading, gpsSpeed, isNavActive]);
}
