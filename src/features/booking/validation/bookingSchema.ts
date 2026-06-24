/**
 * Zod schema for booking creation input (Phase 6).
 *
 * Validation contract:
 * - pickup.label required
 * - destination.label required
 * - passengerCount integer in [1, 6] (UI minimum is 1; service re-clamps to [4, 6] for billing)
 */

import { z } from 'zod';

import type { LatLng } from '@/lib/geo';

const latLngSchema: z.ZodType<LatLng> = z
  .object({
    lat: z.number().finite(),
    lng: z.number().finite(),
  })
  .strict();

const placeSchema = z
  .object({
    label: z.string().trim().min(1, 'Please choose a place.'),
    address: z.string().trim().optional(),
    coords: latLngSchema.nullable(),
  })
  .strict();

export const createBookingSchema = z
  .object({
    pickup: placeSchema,
    destination: placeSchema,
    passengerCount: z
      .number()
      .int('Passenger count must be a whole number.')
      .min(1, 'At least 1 passenger is required.')
      .max(6, 'Up to 6 passengers are allowed.'),
  })
  .strict();

export type CreateBookingFormValues = z.infer<typeof createBookingSchema>;
