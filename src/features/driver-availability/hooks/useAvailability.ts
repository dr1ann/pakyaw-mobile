/**
 * useAvailability — driver availability mutations.
 *
 * Exposes useGoOnlineMutation / useGoOfflineMutation backed by TanStack Query
 * useMutation + presence.service.
 *
 * The preflight gate is enforced by the caller (drive.tsx): it passes
 * preflightPassed=true only after the checklist is confirmed. The mutation
 * verifies this precondition and throws PreflightNotPassedError if not met.
 *
 * This hook does NOT own the location subscription — that belongs to
 * useLocationPublisher. The two are composed in drive.tsx.
 */

import { useMutation } from '@tanstack/react-query';
import * as Location from 'expo-location';

import {
  goOffline as serviceGoOffline,
  goOnline as serviceGoOnline,
} from '@/features/driver-availability/services/presence.service';
import {
  ensureForegroundPermission,
  publishDriverLocation,
} from '@/features/driver-availability/services/location.service';
import {
  DriverAccountNotReadyError,
  PreflightNotPassedError,
} from '@/features/driver-availability/errors';
import { logger } from '@pakyaw/shared/lib/logger';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

/**
 * Returns a TanStack Query mutation that sets the driver online.
 *
 * The preflight signal is passed as a mutation variable at .mutate() time,
 * not via closure, so the value is always read fresh and never stale.
 */
export function useGoOnlineMutation() {
  const uid = useSessionStore((s) => s.uid);
  const setAvailability = useAvailabilityStore((s) => s.setAvailability);
  const setLastLocation = useAvailabilityStore((s) => s.setLastLocation);

  return useMutation({
    mutationFn: async (preflightPassed: boolean) => {
      logger.info('[useAvailability] goOnline mutationFn entered', {
        hasUid: uid != null,
        preflightPassed,
      });
      if (!uid) throw new Error('No authenticated uid');
      if (!preflightPassed) throw new PreflightNotPassedError();

      // Acquire and publish fresh GPS location before requesting online transition
      await ensureForegroundPermission();
      let position = await Location.getLastKnownPositionAsync();
      const isFresh = position && (Date.now() - position.timestamp < 30_000);
      if (!isFresh) {
        position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }
      if (position) {
        setLastLocation(position.coords.latitude, position.coords.longitude);
        await publishDriverLocation(uid, position);
      }

      await serviceGoOnline(uid);
      logger.info('[useAvailability] serviceGoOnline resolved');
    },
    onSuccess: () => {
      setAvailability('online');
      logger.info('[useAvailability] driver went online');
    },
    onError: (err) => {
      if (err instanceof DriverAccountNotReadyError) {
        logger.warn('[useAvailability] goOnline blocked by account verification');
        return;
      }
      logger.error('[useAvailability] goOnline failed:', err);
    },
  });
}

/**
 * Returns a TanStack Query mutation that sets the driver offline.
 */
export function useGoOfflineMutation() {
  const uid = useSessionStore((s) => s.uid);
  const setAvailability = useAvailabilityStore((s) => s.setAvailability);

  return useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error('No authenticated uid');
      await serviceGoOffline(uid);
    },
    onSuccess: () => {
      setAvailability('offline');
      logger.info('[useAvailability] driver went offline');
    },
    onError: (err) => {
      logger.error('[useAvailability] goOffline failed:', err);
    },
  });
}
