import { describe, expect, it } from 'vitest';
import { isInServiceArea, assertInServiceArea, ServiceAreaError } from './index';

describe('serviceArea', () => {
  describe('isInServiceArea', () => {
    it('returns true for coordinates inside Ormoc City bounds', () => {
      // Ormoc center: 11.0050, 124.6075
      expect(isInServiceArea({ lat: 11.0050, lng: 124.6075 })).toBe(true);
      expect(isInServiceArea({ latitude: 11.0050, longitude: 124.6075 })).toBe(true);
      
      // Near boundary
      expect(isInServiceArea({ lat: 10.9500, lng: 124.5500 })).toBe(true);
    });

    it('returns false for coordinates outside Ormoc City bounds', () => {
      // Far north
      expect(isInServiceArea({ lat: 11.2000, lng: 124.6075 })).toBe(false);
      // Far south
      expect(isInServiceArea({ lat: 10.8000, lng: 124.6075 })).toBe(false);
      // Far east
      expect(isInServiceArea({ lat: 11.0050, lng: 124.8000 })).toBe(false);
      // Far west
      expect(isInServiceArea({ lat: 11.0050, lng: 124.4000 })).toBe(false);
    });

    it('returns false for null/undefined coords', () => {
      expect(isInServiceArea(null)).toBe(false);
    });
  });

  describe('assertInServiceArea', () => {
    it('does not throw when place is inside the service area', () => {
      expect(() =>
        assertInServiceArea({
          label: 'Ormoc Superdome',
          coords: { lat: 11.0050, lng: 124.6075 },
        })
      ).not.toThrow();
    });

    it('throws ServiceAreaError when place coords are outside the service area', () => {
      const outsidePlace = {
        label: 'Tacloban City',
        coords: { lat: 11.2444, lng: 125.0039 },
      };
      
      expect(() => assertInServiceArea(outsidePlace)).toThrow(ServiceAreaError);
      
      try {
        assertInServiceArea(outsidePlace);
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceAreaError);
        expect((err as ServiceAreaError).placeLabel).toBe('Tacloban City');
      }
    });

    it('throws ServiceAreaError when place coords are null', () => {
      const nullPlace = {
        label: 'Unknown Place',
        coords: null,
      };
      
      expect(() => assertInServiceArea(nullPlace)).toThrow(ServiceAreaError);
    });
  });
});
