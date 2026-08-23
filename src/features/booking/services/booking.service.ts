/**
 * booking.service — Phase 6 passenger trip creation.
 *
 * Requests a server-authoritative trip through the Day 2 requestTrip callable.
 * The client validates user-entered route data but never writes trips directly.
 *
 * Architectural rules:
 * - billedSeats is ALWAYS re-derived here via clamp(passengerCount). UI state
 *   is never trusted.
 * - Raw FirebaseError instances are translated to BookingOfflineError /
 *   BookingWriteError before being re-thrown.
 */

import { FirebaseError } from 'firebase/app';
import {
  httpsCallable,
} from 'firebase/functions';

import { BookingOfflineError, BookingWriteError } from '@/features/booking/errors';
import type { CreateBookingInput } from '@/features/booking/types';
import { createTripSchema } from '@/features/booking/validation/bookingSchema';
import { logger } from '@pakyaw/shared/lib/logger';
import { assertInServiceArea, TripDistanceTooShortError } from '@/lib/serviceArea';
import { functions } from '@/services/firebase/firebase';

type RequestTripResult = {
  readonly tripId: string;
  readonly status: 'requested';
  readonly offeredDriverCount: number;
};

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
 * Request a new trip using the server-authoritative matching backend.
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

  if (validated.pickup.coords == null || validated.destination.coords == null) {
    throw new BookingWriteError(
      new Error('pickup and destination coordinates are required to request a trip'),
    );
  }
  try {
    const requestTrip = httpsCallable<
      {
        readonly passengerId: string;
        readonly pickup: { readonly latitude: number; readonly longitude: number; readonly label?: string };
        readonly destination: { readonly latitude: number; readonly longitude: number; readonly label?: string };
        readonly fare: { readonly passengerCount: number; readonly displayedTotal: number | null };
      },
      RequestTripResult
    >(functions, 'requestTrip');
    const result = await requestTrip({
      passengerId,
      pickup: {
        latitude: validated.pickup.coords.lat,
        longitude: validated.pickup.coords.lng,
        label: validated.pickup.label,
      },
      destination: {
        latitude: validated.destination.coords.lat,
        longitude: validated.destination.coords.lng,
        label: validated.destination.label,
      },
      fare: {
        passengerCount: validated.passengerCount,
        displayedTotal: input.fare ?? null,
      },
    });
    if (result.data.status !== 'requested' || !result.data.tripId) {
      throw new BookingWriteError(new Error('Trip request returned an invalid result.'));
    }
    logger.info('[booking] trip requested', {
      tripId: result.data.tripId,
      offeredDriverCount: result.data.offeredDriverCount,
    });
    return result.data.tripId;
  } catch (err) {
    logger.error('[booking] createTrip failed', { err });
    throw translateWriteError(err);
  }
}
