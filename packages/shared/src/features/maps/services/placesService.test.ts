import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        googleMapsApiKey: 'AIzaSy_test_key',
      },
    },
  },
}));

import {
  reverseGeocode,
  resolvePickupDisplayLabel,
  isValidPrimaryPickupLabel,
  getNearbyLandmark,
  type GoogleGeocodingResult,
} from './placesService';

describe('placesService — Label Quality, No-Guessing & Nearby Enrichment', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isValidPrimaryPickupLabel()', () => {
    it('rejects broad region, province, country, and plus codes', () => {
      expect(isValidPrimaryPickupLabel('Eastern Visayas')).toBe(false);
      expect(isValidPrimaryPickupLabel('Region VIII')).toBe(false);
      expect(isValidPrimaryPickupLabel('Region 8')).toBe(false);
      expect(isValidPrimaryPickupLabel('Leyte')).toBe(false);
      expect(isValidPrimaryPickupLabel('Philippines')).toBe(false);
      expect(isValidPrimaryPickupLabel('Ormoc City')).toBe(false);
      expect(isValidPrimaryPickupLabel('Ormoc')).toBe(false);
      expect(isValidPrimaryPickupLabel('2J35+XWQ')).toBe(false);
      expect(isValidPrimaryPickupLabel('6500')).toBe(false);
      expect(isValidPrimaryPickupLabel('Unnamed Road')).toBe(false);
      expect(isValidPrimaryPickupLabel('')).toBe(false);
      expect(isValidPrimaryPickupLabel(null)).toBe(false);
    });

    it('accepts specific POIs, establishments, streets, and barangays', () => {
      expect(isValidPrimaryPickupLabel('Camp Downes Elementary School')).toBe(true);
      expect(isValidPrimaryPickupLabel('Camp Downes')).toBe(true);
      expect(isValidPrimaryPickupLabel('Linao')).toBe(true);
      expect(isValidPrimaryPickupLabel('Real St')).toBe(true);
      expect(isValidPrimaryPickupLabel('Robinsons Place Ormoc')).toBe(true);
      expect(isValidPrimaryPickupLabel('San Pedro Street')).toBe(true);
    });
  });

  describe('resolvePickupDisplayLabel()', () => {
    it('prefers POI / establishment over generic components', () => {
      const results: GoogleGeocodingResult[] = [
        {
          formatted_address: 'Camp Downes Elementary School, Camp Downes, Ormoc City, Leyte, Philippines',
          types: ['point_of_interest', 'establishment'],
          address_components: [
            { long_name: 'Camp Downes Elementary School', short_name: 'Camp Downes ES', types: ['point_of_interest', 'establishment'] },
            { long_name: 'Camp Downes', short_name: 'Camp Downes', types: ['administrative_area_level_5'] },
            { long_name: 'Ormoc City', short_name: 'Ormoc City', types: ['locality'] },
            { long_name: 'Leyte', short_name: 'Leyte', types: ['administrative_area_level_2'] },
            { long_name: 'Eastern Visayas', short_name: 'Eastern Visayas', types: ['administrative_area_level_1'] },
          ],
        },
      ];

      const resolved = resolvePickupDisplayLabel(results);
      expect(resolved.primary).toBe('Camp Downes Elementary School');
      expect(resolved.secondary).toContain('Camp Downes, Ormoc City');
    });

    it('uses street + barangay when both are explicitly returned', () => {
      const results: GoogleGeocodingResult[] = [
        {
          formatted_address: 'Real St, Linao, Ormoc City, Leyte, Philippines',
          types: ['street_address'],
          address_components: [
            { long_name: 'Real Street', short_name: 'Real St', types: ['route'] },
            { long_name: 'Linao', short_name: 'Linao', types: ['sublocality'] },
            { long_name: 'Ormoc City', short_name: 'Ormoc City', types: ['locality'] },
            { long_name: 'Leyte', short_name: 'Leyte', types: ['administrative_area_level_2'] },
          ],
        },
      ];

      const resolved = resolvePickupDisplayLabel(results);
      expect(resolved.primary).toBe('Real St, Linao');
      expect(resolved.secondary).toBe('Ormoc City, Leyte');
    });

    it('uses barangay when explicitly returned by Google and route is missing', () => {
      const results: GoogleGeocodingResult[] = [
        {
          formatted_address: 'Camp Downes, Ormoc City, Leyte, Philippines',
          types: ['sublocality', 'political'],
          address_components: [
            { long_name: 'Camp Downes', short_name: 'Camp Downes', types: ['administrative_area_level_5', 'political'] },
            { long_name: 'Ormoc City', short_name: 'Ormoc City', types: ['locality', 'political'] },
            { long_name: 'Leyte', short_name: 'Leyte', types: ['administrative_area_level_2', 'political'] },
          ],
        },
      ];

      const resolved = resolvePickupDisplayLabel(results);
      expect(resolved.primary).toBe('Camp Downes');
      expect(resolved.secondary).toBe('Ormoc City, Leyte');
    });

    it('never assigns a barangay by proximity when only locality/province is returned: falls back to Pinned location', () => {
      const results: GoogleGeocodingResult[] = [
        {
          formatted_address: 'Ormoc City, Leyte, Philippines',
          types: ['locality', 'political'],
          address_components: [
            { long_name: 'Ormoc City', short_name: 'Ormoc City', types: ['locality'] },
            { long_name: 'Leyte', short_name: 'Leyte', types: ['administrative_area_level_2'] },
            { long_name: 'Philippines', short_name: 'PH', types: ['country'] },
          ],
        },
      ];

      const resolved = resolvePickupDisplayLabel(results);
      // Strictly no guessing: Pinned location
      expect(resolved.primary).toBe('Pinned location');
      expect(resolved.secondary).toBe('Ormoc City, Leyte');
      expect(resolved.primary).not.toBe('Eastern Visayas');
      expect(resolved.primary).not.toBe('Leyte');
    });
  });

  describe('getNearbyLandmark()', () => {
    it('extracts valid nearby landmark from Places Nearby Search response', async () => {
      const mockNearbyResponse = {
        status: 'OK',
        results: [
          {
            name: 'Camp Downes Elementary School',
            vicinity: 'Camp Downes, Ormoc City',
            types: ['school', 'point_of_interest', 'establishment'],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNearbyResponse,
      } as unknown as Response);

      const landmark = await getNearbyLandmark(10.9959, 124.6183);
      expect(landmark).not.toBeNull();
      expect(landmark?.name).toBe('Camp Downes Elementary School');
      expect(landmark?.vicinity).toBe('Camp Downes, Ormoc City');
    });
  });

  describe('reverseGeocode() end-to-end integration', () => {
    it('returns exact pin coordinates alongside enriched landmark label', async () => {
      const mockGeocodeResponse = {
        status: 'OK',
        results: [
          {
            formatted_address: 'Ormoc City, Leyte, Philippines',
            types: ['locality'],
            address_components: [
              { long_name: 'Ormoc City', short_name: 'Ormoc City', types: ['locality'] },
              { long_name: 'Leyte', short_name: 'Leyte', types: ['administrative_area_level_2'] },
            ],
          },
        ],
      };

      const mockNearbyResponse = {
        status: 'OK',
        results: [
          {
            name: 'Camp Downes Elementary School',
            vicinity: 'Camp Downes, Ormoc City',
            types: ['school', 'point_of_interest', 'establishment'],
          },
        ],
      };

      // Mock fetch for geocoding and nearby search
      vi.mocked(fetch).mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('geocode/json')) {
          return {
            ok: true,
            json: async () => mockGeocodeResponse,
          } as unknown as Response;
        }
        if (urlStr.includes('nearbysearch/json')) {
          return {
            ok: true,
            json: async () => mockNearbyResponse,
          } as unknown as Response;
        }
        return { ok: false } as unknown as Response;
      });

      const pinCoords = { lat: 10.995912, lng: 124.618345 };
      const place = await reverseGeocode(pinCoords.lat, pinCoords.lng);

      expect(place).not.toBeNull();
      expect(place?.label).toBe('Near Camp Downes Elementary School');
      // Authoritative coordinates remain the exact pin coordinates
      expect(place?.coords).toEqual({ lat: 10.995912, lng: 124.618345 });
    });

    it('falls back strictly to "Pinned location, Ormoc City, Leyte" when no POI or explicit barangay is found', async () => {
      const mockGeocodeResponse = {
        status: 'OK',
        results: [
          {
            formatted_address: '2J35+XWQ, Ormoc City, Leyte, Philippines',
            types: ['plus_code'],
            address_components: [
              { long_name: '2J35+XWQ', short_name: '2J35+XWQ', types: ['plus_code'] },
              { long_name: 'Ormoc City', short_name: 'Ormoc City', types: ['locality'] },
              { long_name: 'Leyte', short_name: 'Leyte', types: ['administrative_area_level_2'] },
              { long_name: 'Eastern Visayas', short_name: 'Eastern Visayas', types: ['administrative_area_level_1'] },
            ],
          },
        ],
      };

      const mockEmptyNearby = {
        status: 'ZERO_RESULTS',
        results: [],
      };

      vi.mocked(fetch).mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('geocode/json')) {
          return {
            ok: true,
            json: async () => mockGeocodeResponse,
          } as unknown as Response;
        }
        return {
          ok: true,
          json: async () => mockEmptyNearby,
        } as unknown as Response;
      });

      const pinCoords = { lat: 10.9959, lng: 124.6183 };
      const place = await reverseGeocode(pinCoords.lat, pinCoords.lng);

      expect(place).not.toBeNull();
      expect(place?.label).toBe('Pinned location');
      expect(place?.label).not.toBe('Eastern Visayas');
      expect(place?.label).not.toBe('Leyte');
      expect(place?.address).toBe('Ormoc City, Leyte');
      expect(place?.coords).toEqual(pinCoords);
    });
  });
});
