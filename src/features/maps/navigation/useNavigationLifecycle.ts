import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  DRIVER_LAST_BACKGROUND_LOCATION_KEY,
  type LastBackgroundLocation,
} from '@/features/driver-availability/services/location.service';
import { logger } from '@pakyaw/shared/lib/logger';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { useAvailabilityStore } from '@/stores/availabilityStore';

type UseNavigationLifecycleParams = {
  readonly isDriving: boolean;
  readonly forceFollow: () => void;
  readonly refetchDriverRoute: () => unknown;
};

function readLastBackgroundLocation(value: string | null): LastBackgroundLocation | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<LastBackgroundLocation>;
    if (
      typeof parsed.latitude !== 'number' ||
      typeof parsed.longitude !== 'number' ||
      typeof parsed.recordedAt !== 'number'
    ) {
      return null;
    }

    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      heading: typeof parsed.heading === 'number' ? parsed.heading : null,
      speed: typeof parsed.speed === 'number' ? parsed.speed : null,
      recordedAt: parsed.recordedAt,
    };
  } catch {
    return null;
  }
}

function seedStoresFromLocation(location: LastBackgroundLocation): void {
  useAvailabilityStore
    .getState()
    .setLastLocation(location.latitude, location.longitude);
  useActiveTripStore
    .getState()
    .setGpsLocation(
      location.latitude,
      location.longitude,
      location.heading,
      location.speed,
    );
}

async function seedFromLastBackgroundLocation(): Promise<void> {
  const raw = await AsyncStorage.getItem(DRIVER_LAST_BACKGROUND_LOCATION_KEY);
  const lastBackgroundLocation = readLastBackgroundLocation(raw);
  if (!lastBackgroundLocation) {
    return;
  }

  seedStoresFromLocation(lastBackgroundLocation);
}

async function seedFromCurrentPosition(): Promise<void> {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
  });

  seedStoresFromLocation({
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    heading: location.coords.heading ?? null,
    speed: location.coords.speed ?? null,
    recordedAt: location.timestamp ?? Date.now(),
  });
}

export function useNavigationLifecycle({
  isDriving,
  forceFollow,
  refetchDriverRoute,
}: UseNavigationLifecycleParams): void {
  const isDrivingRef = useRef(isDriving);
  const forceFollowRef = useRef(forceFollow);
  const refetchDriverRouteRef = useRef(refetchDriverRoute);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const wasDrivingWhenBackgroundedRef = useRef(false);

  useEffect(() => {
    isDrivingRef.current = isDriving;
  }, [isDriving]);

  useEffect(() => {
    forceFollowRef.current = forceFollow;
  }, [forceFollow]);

  useEffect(() => {
    refetchDriverRouteRef.current = refetchDriverRoute;
  }, [refetchDriverRoute]);

  useEffect(() => {
    const store = useActiveTripStore.getState();

    if (!isDriving) {
      store.setNavSession(null);
      return;
    }

    if (!store.navSession) {
      const now = Date.now();
      store.setNavSession({
        startedAt: now,
        lastForegroundAt: now,
        lastBackgroundedAt: null,
      });
    }
  }, [isDriving]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive') {
        return;
      }

      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (previousState === 'active' && nextState === 'background') {
        const wasDriving = isDrivingRef.current;
        wasDrivingWhenBackgroundedRef.current = wasDriving;
        if (!wasDriving) {
          return;
        }

        const now = Date.now();
        const { navSession, setNavSession, updateNavSession } =
          useActiveTripStore.getState();
        if (navSession) {
          updateNavSession({ lastBackgroundedAt: now });
        } else {
          setNavSession({
            startedAt: now,
            lastForegroundAt: now,
            lastBackgroundedAt: now,
          });
        }

        logger.info('nav.lifecycle.background', { at: now });
        return;
      }

      if (previousState !== 'active' && nextState === 'active') {
        if (!wasDrivingWhenBackgroundedRef.current || !isDrivingRef.current) {
          wasDrivingWhenBackgroundedRef.current = false;
          return;
        }

        wasDrivingWhenBackgroundedRef.current = false;

        const now = Date.now();
        const activeTripState = useActiveTripStore.getState();
        const gapMs =
          activeTripState.navSession?.lastBackgroundedAt != null
            ? now - activeTripState.navSession.lastBackgroundedAt
            : null;

        activeTripState.updateNavSession({
          lastForegroundAt: now,
          lastBackgroundedAt: null,
        });
        forceFollowRef.current();
        logger.info('nav.lifecycle.camera.auto_reattached', { at: now });

        void (async () => {
          try {
            await seedFromLastBackgroundLocation();
          } catch (err) {
            logger.warn('nav.lifecycle.resume_bg_seed_failed', {
              error: String(err),
            });
          }

          logger.info('nav.lifecycle.route.refetch_on_resume', { gapMs });
          void refetchDriverRouteRef.current();

          try {
            await seedFromCurrentPosition();
          } catch (err) {
            logger.warn('nav.lifecycle.current_position_seed_failed', {
              error: String(err),
            });
          }
        })();

        logger.info('nav.lifecycle.foreground', { at: now, durationMs: gapMs });
      }
    });

    return () => subscription.remove();
  }, []);
}

