import { functions, httpsCallable, FirebaseError } from '@/services/firebase/firebase';
import { isFareBreakdown, isRideMode, type FareBreakdown, type QuoteTripInput, type QuoteTripResult, type RideMode } from '@pakyaw/shared/transport/contract';
import { logger } from '@pakyaw/shared/lib/logger';
import type { CreateBookingInput } from '@/features/booking/types';
import { createTripSchema } from '@/features/booking/validation/bookingSchema';

export type PassengerFareQuote = {
  readonly mode: RideMode;
  readonly passengerCount: number;
  readonly billedSeats: number;
  readonly fare: FareBreakdown;
};

/**
 * Request an informational, server-calculated quote. This never creates a
 * Trip, and its response is not sent back as authority during booking.
 */
export async function quoteTrip(input: CreateBookingInput): Promise<PassengerFareQuote> {
  const validated = createTripSchema.parse({
    mode: input.mode,
    pickup: input.pickup,
    destination: input.destination,
    passengerCount: input.passengerCount,
    route: input.route,
    displayedFare: null,
    serviceAreaId: 'ormoc',
  });
  if (validated.pickup.coords == null || validated.destination.coords == null) {
    throw new Error('pickup and destination coordinates are required for a fare quote');
  }

  const payload: QuoteTripInput = {
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
  };

  try {
    const call = httpsCallable<QuoteTripInput, QuoteTripResult>(functions, 'quoteTrip');
    const result = await call(payload);
    if (!isRideMode(result.data.mode)
      || !Number.isInteger(result.data.passengerCount)
      || result.data.passengerCount < 1
      || !Number.isInteger(result.data.billedSeats)
      || result.data.billedSeats < 1
      || !isFareBreakdown(result.data.fare)) {
      throw new Error('Quote returned an invalid canonical result');
    }
    return result.data;
  } catch (error) {
    logger.error('[booking] quoteTrip failed', { error });
    if (error instanceof FirebaseError) throw error;
    throw error;
  }
}
