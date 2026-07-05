import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@pakyaw/shared/lib/logger';
import { shouldEmit } from '@/lib/throttle';
import { auth } from '@/services/firebase/firebase';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import {
  DRIVER_BACKGROUND_LOCATION_TASK,
  DRIVER_BACKGROUND_LOCATION_UID_KEY,
  DRIVER_LAST_BACKGROUND_LOCATION_KEY,
  publishDriverLocation,
  type LastBackgroundLocation,
} from './location.service';

type BackgroundLocationTaskData = {
  readonly locations?: Location.LocationObject[];
};

const backgroundThrottleState = {
  lastAt: null as number | null,
  lastGeo: null as { lat: number; lng: number } | null,
};

TaskManager.defineTask<BackgroundLocationTaskData>(
  DRIVER_BACKGROUND_LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      logger.error('[location] background task failed', { error });
      return;
    }

    const uid =
      auth.currentUser?.uid ??
      useSessionStore.getState().uid ??
      await AsyncStorage.getItem(DRIVER_BACKGROUND_LOCATION_UID_KEY);
    if (!uid) {
      logger.warn('[location] background task skipped without driver session');
      return;
    }

    const locations = data.locations ?? [];
    const latestLocation = locations[locations.length - 1];
    if (!latestLocation) {
      return;
    }

    const now = Date.now();
    const geo = {
      lat: latestLocation.coords.latitude,
      lng: latestLocation.coords.longitude,
    };
    const lastBackgroundLocation: LastBackgroundLocation = {
      latitude: latestLocation.coords.latitude,
      longitude: latestLocation.coords.longitude,
      heading: latestLocation.coords.heading ?? null,
      speed: latestLocation.coords.speed ?? null,
      recordedAt: latestLocation.timestamp ?? now,
    };

    try {
      await AsyncStorage.setItem(
        DRIVER_LAST_BACKGROUND_LOCATION_KEY,
        JSON.stringify(lastBackgroundLocation),
      );
    } catch (err) {
      logger.warn('[location] failed to persist last background location', {
        error: String(err),
      });
    }

    if (
      !shouldEmit({
        lastAt: backgroundThrottleState.lastAt,
        lastGeo: backgroundThrottleState.lastGeo,
        now,
        geo,
      })
    ) {
      return;
    }

    backgroundThrottleState.lastAt = now;
    backgroundThrottleState.lastGeo = geo;

    try {
      await publishDriverLocation(uid, latestLocation);
      logger.info('[location] background location published', geo);
    } catch (err) {
      logger.error('[location] background publish failed', { error: err });
    }
  },
);
