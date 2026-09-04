import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { useSegments } from 'expo-router';
import { useLocationStore } from '@/stores/locationStore';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { firestore, doc, setDoc, deleteDoc, serverTimestamp } from '@/services/firebase/firebase';
import { logger } from '@pakyaw/shared/lib/logger';

const PRE_PICKUP_STATUSES = new Set(['accepted', 'driver_arriving', 'driver_arrived']);

export function usePassengerLocationPublisher() {
  const uid = useSessionStore((s) => s.uid);
  const segments = useSegments() as string[];
  const setLocation = useLocationStore((s) => s.setLocation);
  const setPermissionStatus = useLocationStore((s) => s.setPermissionStatus);
  const resetStore = useLocationStore((s) => s.reset);
  const trip = useActiveTripStore((s) => s.trip);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const activeTripIdRef = useRef<string | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  const isRideActive = !segments.includes('activity') && !segments.includes('account');
  const isAppActive = appState === 'active';
  const shouldSubscribe = !!uid && isRideActive && isAppActive;

  const tripId = trip?.id ?? null;
  const tripStatus = trip?.status ?? null;
  const isTripPrePickup = !!trip && !!tripId && !!tripStatus && PRE_PICKUP_STATUSES.has(tripStatus) && trip.passengerId === uid;

  // Track active trip id for cleanup
  useEffect(() => {
    const previousTripId = activeTripIdRef.current;
    if (isTripPrePickup) {
      activeTripIdRef.current = tripId;
    } else {
      activeTripIdRef.current = null;
      if (previousTripId) {
        logger.info('[PassengerLocationPublisher] Pre-pickup ended, deleting temporary live location', { tripId: previousTripId });
        void deleteDoc(doc(firestore, 'passengerLocations', previousTripId)).catch((err) => {
          logger.warn('[PassengerLocationPublisher] Failed to delete temporary location doc on pre-pickup exit', err);
        });
      }
    }
  }, [isTripPrePickup, tripId]);

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
      setAppState(nextState);
    });

    return () => {
      appStateSub.remove();
    };
  }, []);

  const permissionStatus = useLocationStore((s) => s.permissionStatus);

  const evaluateSubscription = useCallback(async () => {
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
            timeInterval: 3000,
            distanceInterval: 3,
          },
          (loc) => {
            setLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading ?? null,
              accuracy: loc.coords.accuracy ?? null,
              timestamp: loc.timestamp,
            });

            // Publish temporary live location only during active pre-pickup states
            const currentTrip = useActiveTripStore.getState().trip;
            const currentUid = useSessionStore.getState().uid;
            if (
              currentTrip &&
              currentTrip.id &&
              currentTrip.status &&
              PRE_PICKUP_STATUSES.has(currentTrip.status) &&
              currentTrip.passengerId === currentUid
            ) {
              void setDoc(doc(firestore, 'passengerLocations', currentTrip.id), {
                passengerId: currentUid,
                tripId: currentTrip.id,
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                accuracyMeters: loc.coords.accuracy ?? null,
                updatedAt: serverTimestamp(),
              }).catch((err) => {
                logger.warn('[PassengerLocationPublisher] Failed to update temporary passenger location', err);
              });
            }
          }
        );
      } catch (err) {
        logger.error('[PassengerLocationPublisher] Failed to start watchPositionAsync', err);
      }
    }
  }, [shouldSubscribe, permissionStatus, setLocation]);

  useEffect(() => {
    void evaluateSubscription();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      if (activeTripIdRef.current) {
        const cleanupId = activeTripIdRef.current;
        activeTripIdRef.current = null;
        void deleteDoc(doc(firestore, 'passengerLocations', cleanupId)).catch((err) => {
          logger.warn('[PassengerLocationPublisher] Failed to cleanup temporary location doc on unmount', err);
        });
      }
    };
  }, [evaluateSubscription]);
}
