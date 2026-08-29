import { FirebaseError } from 'firebase/app';
import { httpsCallable } from 'firebase/functions';

import type { FareBreakdown, QuoteTripInput, QuoteTripResult } from '@pakyaw/shared/transport/contract';
import { logger } from '@pakyaw/shared/lib/logger';
import { functions } from '@/services/firebase/firebase';
import type { CreateBookingInput } from '@/features/booking/types';
import { createTripSchema } from '@/features/booking/validation/bookingSchema';

export type PassengerFareQuote = {
  readonly mode: 'solo';
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
    if (result.data.mode !== 'solo' || result.data.billedSeats !== result.data.passengerCount) {
      throw new Error('Quote returned an invalid canonical result');
    }
    return result.data;
  } catch (error) {
    logger.error('[booking] quoteTrip failed', { error });
    if (error instanceof FirebaseError) throw error;
    throw error;
  }
}
