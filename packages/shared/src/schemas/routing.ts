import { z } from 'zod';

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
  .passthrough();

/**
 * Zod schema for Google Directions API response validation with steps (Phase 12 Navigation).
 */
export const navRouteResponseSchema = z
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
                steps: z.array(
                  z.object({
                    maneuver: z.string().optional().nullable(),
                    html_instructions: z.string(),
                    distance: z.object({
                      value: z.number().int().nonnegative(),
                    }),
                    start_location: z.object({
                      lat: z.number(),
                      lng: z.number(),
                    }),
                    end_location: z.object({
                      lat: z.number(),
                      lng: z.number(),
                    }),
                    polyline: z.object({
                      points: z.string(),
                    }),
                  })
                ),
              })
            )
            .min(1),
        })
      )
      .min(1),
  })
  .passthrough();
