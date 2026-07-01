import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { useSegments } from 'expo-router';
import { useLocationStore } from '@/stores/locationStore';
import { useSessionStore } from '@/stores/sessionStore';
import { logger } from '@/lib/logger';

export function usePassengerLocationPublisher() {
  const uid = useSessionStore((s) => s.uid);
  const segments = useSegments() as string[];
  const setLocation = useLocationStore((s) => s.setLocation);
  const setPermissionStatus = useLocationStore((s) => s.setPermissionStatus);
  const resetStore = useLocationStore((s) => s.reset);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const isRideActive = !segments.includes('activity') && !segments.includes('account');
  const isAppActive = appStateRef.current === 'active';
  const shouldSubscribe = !!uid && isRideActive && isAppActive;

  // Handle permission request and status sync
  useEffect(() => {
    if (!uid) {
      resetStore();
      return;
    }

    let active = true;
    async function checkAndRequestPermission() {
      try {
        const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
        if (!active) return;

        let finalStatus = existingStatus;
        if (existingStatus === 'undetermined') {
          logger.info('[PassengerLocationPublisher] Requesting foreground permission...');
          const { status: askedStatus } = await Location.requestForegroundPermissionsAsync();
          finalStatus = askedStatus;
        }

        if (active) {
          setPermissionStatus(finalStatus);
        }
      } catch (err) {
        logger.error('[PassengerLocationPublisher] Failed to check/request permission', err);
      }
    }

    void checkAndRequestPermission();

    return () => {
      active = false;
    };
  }, [uid, setPermissionStatus, resetStore]);

  // Handle AppState changes
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      appStateRef.current = nextState;
      void evaluateSubscription();
    });

    return () => {
      appStateSub.remove();
    };
  });

  const permissionStatus = useLocationStore((s) => s.permissionStatus);

  const evaluateSubscription = async () => {
    if (!shouldSubscribe || permissionStatus !== 'granted') {
      if (subscriptionRef.current) {
        logger.info('[PassengerLocationPublisher] Stopping location watch (Idle/Suspended)');
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      return;
    }

    if (!subscriptionRef.current) {
      logger.info('[PassengerLocationPublisher] Starting location watch (Active)');
      try {
        subscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 2000,
            distanceInterval: 2,
          },
          (loc) => {
            setLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading ?? null,
              accuracy: loc.coords.accuracy ?? null,
              timestamp: loc.timestamp,
            });
          }
        );
      } catch (err) {
        logger.error('[PassengerLocationPublisher] Failed to start watchPositionAsync', err);
      }
    }
  };

  useEffect(() => {
    void evaluateSubscription();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, [shouldSubscribe, permissionStatus]);
}
