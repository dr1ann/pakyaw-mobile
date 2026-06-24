/**
 * booking.service — Phase 6 passenger trip creation.
 *
 * Writes trips/{auto} with status='request'. No driver matching and no
 * lifecycle transitions. Lifecycle states beyond 'request' belong to later
 * phases.
 *
 * Architectural rules:
 * - billedSeats is ALWAYS re-derived here via clamp(passengerCount). UI state
 *   is never trusted.
 * - Raw FirebaseError instances are translated to BookingOfflineError /
 *   BookingWriteError before being re-thrown.
 */

import { FirebaseError } from 'firebase/app';
import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { BookingOfflineError, BookingWriteError } from '@/features/booking/errors';
import type { CreateBookingInput, TripCreateData } from '@/features/booking/types';
import { geohashOf } from '@/lib/geo';
import { logger } from '@/lib/logger';
import { clamp } from '@/lib/seatModel';
import { firestore } from '@/services/firebase/firebase';

/**
 * Translate raw Firebase / network errors into booking domain errors.
 * Connectivity-class failures become BookingOfflineError; everything else
 * becomes BookingWriteError so the UI never sees a raw Firestore code.
 */
function translateWriteError(err: unknown): BookingOfflineError | BookingWriteError {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'unavailable':
      case 'deadline-exceeded':
        return new BookingOfflineError();
      default:
        return new BookingWriteError(err);
    }
  }
  return new BookingWriteError(err);
}

/**
 * Create a new trip request document.
 *
 * @param input - Validated booking input (pickup, destination, passengerCount).
 * @param passengerId - Firebase Auth uid of the requesting passenger.
 * @returns The auto-generated tripId.
 * @throws BookingOfflineError on connectivity failures.
 * @throws BookingWriteError on any other write failure.
 */
export async function createTrip(
  input: CreateBookingInput,
  passengerId: string,
): Promise<string> {
  // Re-derive billedSeats inside the service — never trust UI state.
  const billedSeats = clamp(input.passengerCount);

  if (input.pickup.coords == null) {
    throw new BookingWriteError(
      new Error('pickup.coords required to compute geohash'),
    );
  }
  const geohash = geohashOf(input.pickup.coords, 7);

  const data: TripCreateData = {
    mode: 'solo',
    passengerId,
    driverId: null,
    pickup: input.pickup,
    destination: input.destination,
    passengerCount: input.passengerCount,
    billedSeats,
    status: 'request',
    geohash,
    requestedAt: serverTimestamp(),
  };

  try {
    logger.info('[booking] creating trip', {
      pickupCoords: input.pickup.coords,
      geohash,
    });
    // Bypass the wrapper converter on collections.trips() — we want a flat
    // document payload, not { id, data } wrapped through toFirestore.
    const tripsRaw = collection(firestore, 'trips');
    const ref = await addDoc(tripsRaw, data);
    logger.info('[booking] trip created', { tripId: ref.id });
    return ref.id;
  } catch (err) {
    logger.error('[booking] createTrip failed', { err });
    throw translateWriteError(err);
  }
}
