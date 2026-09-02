/**
 * booking.service — Phase 6 passenger trip creation.
 *
 * Requests a server-authoritative trip through the Day 2 requestTrip callable.
 * The client validates user-entered route data but never writes trips directly.
 *
 * Architectural rules:
 * - billedSeats and authoritative fare are derived by the backend. The client
 *   sends passenger intent and route context only.
 * - Raw FirebaseError instances are translated to BookingOfflineError /
 *   BookingWriteError before being re-thrown.
 */

import { functions, httpsCallable, FirebaseError } from '@/services/firebase/firebase';

import { BookingOfflineError, BookingWriteError } from '@/features/booking/errors';
import type { CreateBookingInput } from '@/features/booking/types';
import { createTripSchema } from '@/features/booking/validation/bookingSchema';
import { logger } from '@pakyaw/shared/lib/logger';
import type { RequestTripInput } from '@pakyaw/shared/transport/contract';
import { assertInServiceArea, TripDistanceTooShortError } from '@/lib/serviceArea';

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
 * @param input - Validated booking input (mode, pickup, destination, passengerCount, route).
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
    mode: input.mode,
    pickup: input.pickup,
    destination: input.destination,
    passengerCount: input.passengerCount,
    route: input.route,
    displayedFare: input.displayedFare,
    serviceAreaId: 'ormoc',
  });

  if (validated.pickup.coords == null || validated.destination.coords == null) {
    throw new BookingWriteError(
      new Error('pickup and destination coordinates are required to request a trip'),
    );
  }
  try {
    const requestTrip = httpsCallable<RequestTripInput, RequestTripResult>(functions, 'requestTrip');
    const result = await requestTrip({
      passengerId,
      mode: validated.mode,
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
      route: validated.route,
      passengerCount: validated.passengerCount,
      displayedFare: validated.displayedFare ?? null,
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
