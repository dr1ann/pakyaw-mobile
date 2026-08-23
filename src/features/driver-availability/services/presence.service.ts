/**
 * Presence service — manages driver availability writes to Firestore.
 *
 * Scope: Phase 5 only. Writes go to drivers/{uid}.
 * No reads — the store is updated by the calling hooks.
 *
 * Firestore field contract:
 *   Going online:
 *     availability: 'online'
 *     preflightPassedAt: serverTimestamp()
 *     lastSeenAt: serverTimestamp()
 *
 *   Going offline:
 *     availability: 'offline'
 *     lastSeenAt: serverTimestamp()
 */

import { doc, type FieldValue, serverTimestamp, setDoc } from 'firebase/firestore';

import {
  DriverAccountNotReadyError,
  translatePresenceWriteError,
} from '@/features/driver-availability/errors';
import { logger } from '@pakyaw/shared/lib/logger';
import { firestore } from '@/services/firebase/firebase';

type GoOnlinePayload = {
  availability: 'online';
  preflightPassedAt: FieldValue;
  lastSeenAt: FieldValue;
};

type GoOfflinePayload = {
  availability: 'offline';
  lastSeenAt: FieldValue;
};

/**
 * Sets driver availability to 'online' in Firestore.
 * Stamps preflightPassedAt and lastSeenAt with serverTimestamp().
 *
 * Uses setDoc+merge so a pre-provisioned driver doc that doesn't yet exist
 * in Firestore is safely created on first go-online.
 *
 * Throws PresenceWriteError on failure.
 */
export async function goOnline(uid: string): Promise<void> {
  const payload: GoOnlinePayload = {
    availability: 'online',
    preflightPassedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  };

  logger.info('[presence] goOnline: writing drivers/{uid}', { uid });
  try {
    const driverRef = doc(firestore, 'drivers', uid);
    await setDoc(driverRef, payload, { merge: true });
    logger.info('[presence] goOnline: setDoc resolved', { uid });
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
 * Sets driver availability to 'offline' in Firestore.
 * Stamps lastSeenAt with serverTimestamp().
 *
 * Throws PresenceWriteError on failure.
 */
export async function goOffline(uid: string): Promise<void> {
  const payload: GoOfflinePayload = {
    availability: 'offline',
    lastSeenAt: serverTimestamp(),
  };

  try {
    const driverRef = doc(firestore, 'drivers', uid);
    await setDoc(driverRef, payload, { merge: true });
    logger.info('[presence] driver offline:', uid);
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
