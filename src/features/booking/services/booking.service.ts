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
import { createTripSchema } from '@/features/booking/validation/bookingSchema';
import { geohashOf } from '@pakyaw/shared/lib/geo';
import { logger } from '@pakyaw/shared/lib/logger';
import { clamp } from '@/lib/seatModel';
import { assertInServiceArea, TripDistanceTooShortError } from '@/lib/serviceArea';
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
 * @throws ServiceAreaError if pickup or destination are outside the service area.
 * @throws TripDistanceTooShortError if the route distance is too short.
 * @throws BookingOfflineError on connectivity failures.
 * @throws BookingWriteError on any other write failure.
 */
export async function createTrip(
  input: CreateBookingInput,
  passengerId: string,
): Promise<string> {
  // Assert service area boundaries - throws ServiceAreaError if outside
  assertInServiceArea(input.pickup);
  assertInServiceArea(input.destination);

  // Validate route distance
  if (input.route.distanceMeters < 50) {
    throw new TripDistanceTooShortError(input.route.distanceMeters);
  }

  // Validate full payload at the service boundary before any network call.
  const validated = createTripSchema.parse({
    pickup: input.pickup,
    destination: input.destination,
    passengerCount: input.passengerCount,
    route: input.route,
    serviceAreaId: 'ormoc',
  });

  // Re-derive billedSeats inside the service — never trust UI state.
  const billedSeats = clamp(validated.passengerCount);

  if (validated.pickup.coords == null) {
    throw new BookingWriteError(
      new Error('pickup.coords required to compute geohash'),
    );
  }
  const geohash = geohashOf(validated.pickup.coords, 7);

  const data: TripCreateData = {
    mode: input.mode === 'private' ? 'solo' : (input.mode || 'solo'),
    passengerId,
    driverId: null,
    pickup: validated.pickup,
    destination: validated.destination,
    passengerCount: validated.passengerCount,
    billedSeats: input.mode === 'shared' ? input.passengerCount : billedSeats,
    ...(input.mode === 'shared' && { seatsCovered: input.passengerCount }),
    status: 'request',
    geohash,
    requestedAt: serverTimestamp(),
    createdTime: serverTimestamp(),
    ...(input.fare !== undefined && { fare: input.fare }),
    route: validated.route,
    serviceAreaId: 'ormoc',
  };

  try {
    logger.info('[booking] creating trip', {
      pickupCoords: validated.pickup.coords,
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
