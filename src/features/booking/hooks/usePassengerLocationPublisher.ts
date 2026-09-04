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

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function usePassengerLocationPublisher() {
  const uid = useSessionStore((s) => s.uid);
  const segments = useSegments() as string[];
  const setLocation = useLocationStore((s) => s.setLocation);
  const setPermissionStatus = useLocationStore((s) => s.setPermissionStatus);
  const resetStore = useLocationStore((s) => s.reset);
  const trip = useActiveTripStore((s) => s.trip);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const activeTripIdRef = useRef<string | null>(null);
  const lastPublishedAtRef = useRef<number>(0);
  const lastPublishedLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  const isRideActive = !segments.includes('activity') && !segments.includes('account');
  const isAppActive = appState === 'active';
  const shouldSubscribe = !!uid && isRideActive && isAppActive;

  const tripId = trip?.id ?? null;
  const tripStatus = trip?.status ?? null;
  const isBookingForSelf = !trip?.bookingFor || trip.bookingFor === 'self';
  const isTripPrePickup = !!trip && !!tripId && !!tripStatus && PRE_PICKUP_STATUSES.has(tripStatus) && trip.passengerId === uid && isBookingForSelf;

  // Track active trip id for cleanup
  useEffect(() => {
    const previousTripId = activeTripIdRef.current;
    if (isTripPrePickup) {
      activeTripIdRef.current = tripId;
    } else {
      activeTripIdRef.current = null;
      lastPublishedAtRef.current = 0;
      lastPublishedLocationRef.current = null;
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

            // Publish temporary live location only during active pre-pickup states for self-bookings
            const currentTrip = useActiveTripStore.getState().trip;
            const currentUid = useSessionStore.getState().uid;
            const isSelf = !currentTrip?.bookingFor || currentTrip.bookingFor === 'self';
            if (
              currentTrip &&
              currentTrip.id &&
              currentTrip.status &&
              PRE_PICKUP_STATUSES.has(currentTrip.status) &&
              currentTrip.passengerId === currentUid &&
              isSelf
            ) {
              const now = Date.now();
              const timeSinceLastPublish = now - lastPublishedAtRef.current;

              // Enforce strict minimum time throttle: never write more frequently than every 3000ms
              if (timeSinceLastPublish < 3000) {
                return;
              }

              // Movement filter: write if first publish, moved >= 3m, or heartbeat (15s)
              const lastLoc = lastPublishedLocationRef.current;
              const hasMovedMeaningfully =
                !lastLoc ||
                distanceMeters(lastLoc.latitude, lastLoc.longitude, loc.coords.latitude, loc.coords.longitude) >= 3;

              if (!hasMovedMeaningfully && timeSinceLastPublish < 15000) {
                return;
              }

              lastPublishedAtRef.current = now;
              lastPublishedLocationRef.current = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              };

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
