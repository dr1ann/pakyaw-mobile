import { z } from 'zod';

import type { LatLng } from '@/lib/geo';

export const latLngSchema: z.ZodType<LatLng> = z
  .object({
    lat: z.number().finite(),
    lng: z.number().finite(),
  })
  .strict();

export const placeSchema = z
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

/**
 * Zod schema for validated trip creation (Phase 12).
 */
export const createTripSchema = z
  .object({
    pickup: placeSchema,
    destination: placeSchema,
    passengerCount: z.number().int().min(1).max(6),
    route: z.object({
      distanceMeters: z.number().int().positive().max(60_000),
      durationSeconds: z.number().int().positive().max(3 * 3600),
      polyline: z.string().min(1).max(8192),
    }),
    serviceAreaId: z.literal('ormoc'),
  })
  .strict();

/**
 * Zod schema for Google Directions API response validation (Phase 12).
 */
export const routeResponseSchema = z
  .object({
    routes: z
      .array(
        z.object({
          overview_polyline: z.object({
            points: z.string().min(1),
          }),
          legs: z
            .array(
              z.object({
                distance: z.object({
                  value: z.number().int().nonnegative(),
                  text: z.string().optional(),
                }),
                duration: z.object({
                  value: z.number().int().nonnegative(),
                  text: z.string().optional(),
                }),
              })
            )
            .min(1),
        })
      )
      .min(1),
  })
  .passthrough(); // Allow other Google Directions API response fields

