/**
 * Presence service — sends driver availability intent to the backend.
 *
 * The mobile client never writes drivers/{uid}.availability directly. The
 * backend validates the driver account and active ride state before changing
 * availability; this service only invokes that callable.
 *
 * Firestore field contract:
 * The store is updated by the calling hooks after the callable succeeds.
 */

import {
  DriverAccountNotReadyError,
  translatePresenceWriteError,
} from '@/features/driver-availability/errors';
import { logger } from '@pakyaw/shared/lib/logger';
import { functions, httpsCallable } from '@/services/firebase/firebase';

/**
 * Requests that the backend set driver availability to 'online'.
 *
 * Throws PresenceWriteError on failure.
 */
export async function goOnline(uid: string): Promise<void> {
  logger.info('[presence] goOnline: requesting backend availability transition', { uid });
  try {
    await httpsCallable<{ readonly driverId: string; readonly availability: 'online' }, { readonly availability: 'online' }>(
      functions,
      'setDriverAvailability',
    )({ driverId: uid, availability: 'online' });
    logger.info('[presence] goOnline: backend transition resolved', { uid });
  } catch (cause) {
    const error = translatePresenceWriteError(cause);
    // An account still awaiting verification is an expected product state,
    // not an application crash. Keep the raw Firebase error out of the
    // driver-facing/error-level log while retaining a useful diagnostic.
    if (error instanceof DriverAccountNotReadyError) {
      logger.warn('[presence] goOnline blocked by account verification', { uid });
    } else {
      logger.error('[presence] goOnline failed:', cause);
    }
    throw error;
  }
}

/**
 * Requests that the backend set driver availability to 'offline'.
 *
 * Throws PresenceWriteError on failure.
 */
export async function goOffline(uid: string): Promise<void> {
  try {
    await httpsCallable<{ readonly driverId: string; readonly availability: 'offline' }, { readonly availability: 'offline' }>(
      functions,
      'setDriverAvailability',
    )({ driverId: uid, availability: 'offline' });
    logger.info('[presence] backend set driver offline:', uid);
  } catch (cause) {
    const error = translatePresenceWriteError(cause);
    if (error instanceof DriverAccountNotReadyError) {
      logger.warn('[presence] goOffline blocked by account verification', { uid });
    } else {
      logger.error('[presence] goOffline failed:', cause);
    }
    throw error;
  }
}
