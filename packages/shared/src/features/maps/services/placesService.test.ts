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
  type GoogleGeocodingResult,
} from './placesService';
import { lookupOrmocBarangay } from '@pakyaw/shared/constants/ormocBarangays';

describe('placesService — Label Quality & Primary Filter', () => {
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

    it('uses street + barangay when available', () => {
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

    it('uses barangay when route is missing', () => {
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

    it('NEVER promotes Eastern Visayas, Leyte, or Philippines to primary label', () => {
      const results: GoogleGeocodingResult[] = [
        {
          formatted_address: 'Eastern Visayas, Philippines',
          types: ['administrative_area_level_1', 'political'],
          address_components: [
            { long_name: 'Eastern Visayas', short_name: 'Eastern Visayas', types: ['administrative_area_level_1'] },
            { long_name: 'Philippines', short_name: 'PH', types: ['country'] },
          ],
        },
      ];

      const resolved = resolvePickupDisplayLabel(results);
      expect(resolved.primary).toBe('Pinned location');
      expect(resolved.primary).not.toBe('Eastern Visayas');
      expect(resolved.primary).not.toBe('Philippines');
    });

    it('NEVER promotes Leyte or pure locality to primary label', () => {
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
      expect(resolved.primary).toBe('Pinned location');
      expect(resolved.primary).not.toBe('Leyte');
      expect(resolved.primary).not.toBe('Ormoc City');
      expect(resolved.secondary).toBe('Ormoc City, Leyte');
    });
  });

  describe('lookupOrmocBarangay() local dataset', () => {
    it('accurately resolves Camp Downes coordinates', () => {
      expect(lookupOrmocBarangay(10.9959, 124.6183)).toBe('Camp Downes');
    });

    it('accurately resolves Linao coordinates', () => {
      expect(lookupOrmocBarangay(11.0345, 124.6012)).toBe('Linao');
    });

    it('accurately resolves Cogon coordinates', () => {
      expect(lookupOrmocBarangay(11.0254, 124.6050)).toBe('Cogon');
    });

    it('accurately resolves San Pedro coordinates', () => {
      expect(lookupOrmocBarangay(11.0049, 124.6098)).toBe('San Pedro');
    });
  });

  describe('reverseGeocode() end-to-end', () => {
    it('resolves Camp Downes from local enrichment when Google only provides broad city result', async () => {
      const mockGeocodeResponse = {
        status: 'OK',
        results: [
          {
            formatted_address: '2J35+XWQ Ormoc City, Leyte, Philippines',
            types: ['plus_code'],
            address_components: [
              { long_name: '2J35+XWQ', short_name: '2J35+XWQ', types: ['plus_code'] },
              { long_name: 'Ormoc City', short_name: 'Ormoc City', types: ['locality'] },
              { long_name: 'Leyte', short_name: 'Leyte', types: ['administrative_area_level_2'] },
              { long_name: 'Eastern Visayas', short_name: 'Eastern Visayas', types: ['administrative_area_level_1'] },
              { long_name: 'Philippines', short_name: 'PH', types: ['country'] },
            ],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeocodeResponse,
      } as unknown as Response);

      const result = await reverseGeocode(10.9959, 124.6183);
      expect(result).not.toBeNull();
      // Enriched by local barangay lookup for Camp Downes coordinates
      expect(result?.label).toBe('Camp Downes');
      expect(result?.label).not.toBe('Eastern Visayas');
      expect(result?.label).not.toBe('Leyte');
      expect(result?.address).toBe('Ormoc City, Leyte');
    });

    it('resolves specific POI if Google returns it', async () => {
      const mockGeocodeResponse = {
        status: 'OK',
        results: [
          {
            formatted_address: 'Camp Downes Elementary School, Camp Downes, Ormoc City, Leyte, Philippines',
            types: ['point_of_interest', 'establishment'],
            address_components: [
              { long_name: 'Camp Downes Elementary School', short_name: 'Camp Downes ES', types: ['point_of_interest'] },
              { long_name: 'Camp Downes', short_name: 'Camp Downes', types: ['administrative_area_level_5'] },
              { long_name: 'Ormoc City', short_name: 'Ormoc City', types: ['locality'] },
            ],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeocodeResponse,
      } as unknown as Response);

      const result = await reverseGeocode(10.9959, 124.6183);
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Camp Downes Elementary School');
    });
  });
});
