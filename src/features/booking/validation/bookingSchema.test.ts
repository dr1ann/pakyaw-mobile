import { describe, expect, it } from 'vitest';
import { createTripSchema, routeResponseSchema } from './bookingSchema';

describe('bookingSchema validation', () => {
  describe('createTripSchema', () => {
    const validTrip = {
      mode: 'solo',
      pickup: {
        label: 'Ormoc City Hall',
        address: 'Ormoc City, Leyte',
        coords: { lat: 11.0050, lng: 124.6075 },
      },
      destination: {
        label: 'Ormoc Superdome',
        address: 'Ormoc City, Leyte',
        coords: { lat: 11.0070, lng: 124.6090 },
      },
      passengerCount: 3,
      route: {
        distanceMeters: 1500,
        durationSeconds: 300,
        polyline: 'a~fF~pszU_cghD',
      },
      serviceAreaId: 'ormoc',
    };

    it('passes for a valid trip payload', () => {
      const result = createTripSchema.safeParse(validTrip);
      expect(result.success).toBe(true);
    });

    it('fails if passengerCount is out of range [1, 6]', () => {
      const tooMany = { ...validTrip, passengerCount: 7 };
      const tooFew = { ...validTrip, passengerCount: 0 };

      expect(createTripSchema.safeParse(tooMany).success).toBe(false);
      expect(createTripSchema.safeParse(tooFew).success).toBe(false);
    });

    it.each(['private', 'hopon', 'hop_on', 'pakyaw'])('rejects legacy mode %s', (mode) => {
      expect(createTripSchema.safeParse({ ...validTrip, mode }).success).toBe(false);
    });

    it('fails if serviceAreaId is not ormoc', () => {
      const invalidArea = { ...validTrip, serviceAreaId: 'tacloban' };
      expect(createTripSchema.safeParse(invalidArea).success).toBe(false);
    });

    it('fails if distance exceeds 60,000 meters', () => {
      const tooFar = {
        ...validTrip,
        route: { ...validTrip.route, distanceMeters: 60001 },
      };
      expect(createTripSchema.safeParse(tooFar).success).toBe(false);
    });

    it('validates bookingFor, rider, and pickupNote', () => {
      // Valid self booking
      const selfBooking = { ...validTrip, bookingFor: 'self' };
      expect(createTripSchema.safeParse(selfBooking).success).toBe(true);

      // Valid other booking with rider and pickup note
      const otherBooking = {
        ...validTrip,
        bookingFor: 'other',
        rider: { firstName: 'Anna' },
        pickupNote: 'Waiting near the gate',
      };
      expect(createTripSchema.safeParse(otherBooking).success).toBe(true);

      // Invalid other booking with empty rider name
      const emptyRider = {
        ...validTrip,
        bookingFor: 'other',
        rider: { firstName: '  ' },
      };
      expect(createTripSchema.safeParse(emptyRider).success).toBe(false);

      // Invalid pickup note exceeding 140 chars
      const longNote = {
        ...validTrip,
        bookingFor: 'other',
        rider: { firstName: 'Anna' },
        pickupNote: 'a'.repeat(141),
      };
      expect(createTripSchema.safeParse(longNote).success).toBe(false);
    });
  });

  describe('routeResponseSchema', () => {
    const validGoogleResponse = {
      routes: [
        {
          overview_polyline: {
            points: 'a~fF~pszU_cghD',
          },
          legs: [
            {
              distance: { value: 1500, text: '1.5 km' },
              duration: { value: 300, text: '5 mins' },
            },
          ],
        },
      ],
    };

    it('passes for a valid Google Directions API response', () => {
      const result = routeResponseSchema.safeParse(validGoogleResponse);
      expect(result.success).toBe(true);
    });

    it('fails if routes array is empty', () => {
      const emptyRoutes = { routes: [] };
      expect(routeResponseSchema.safeParse(emptyRoutes).success).toBe(false);
    });

    it('fails if polyline points are empty or missing', () => {
      const emptyPoints = {
        routes: [
          {
            overview_polyline: { points: '' },
            legs: [
              {
                distance: { value: 1500 },
                duration: { value: 300 },
              },
            ],
          },
        ],
      };
      expect(routeResponseSchema.safeParse(emptyPoints).success).toBe(false);
    });
  });
});
