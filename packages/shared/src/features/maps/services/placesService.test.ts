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

import { reverseGeocode } from './placesService';

describe('placesService — reverseGeocode()', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully strips plus codes and extracts human-readable street labels', async () => {
    const mockGeocodeResponse = {
      status: 'OK',
      results: [
        {
          formatted_address: '2J35+XWQ, San Pedro St, Ormoc City, Leyte, Philippines',
          types: ['establishment', 'point_of_interest'],
          address_components: [
            { long_name: '2J35+XWQ', short_name: '2J35+XWQ', types: ['plus_code'] },
            { long_name: 'San Pedro Street', short_name: 'San Pedro St', types: ['route'] },
            { long_name: 'Ormoc City', short_name: 'Ormoc City', types: ['locality', 'political'] },
            { long_name: 'Leyte', short_name: 'Leyte', types: ['administrative_area_level_2', 'political'] },
            { long_name: 'Philippines', short_name: 'PH', types: ['country', 'political'] },
          ],
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockGeocodeResponse,
    } as unknown as Response);

    const result = await reverseGeocode(11.0049, 124.6098);
    expect(result).not.toBeNull();
    expect(result?.label).toBe('San Pedro Street');
    expect(result?.address).toBe('San Pedro St, Ormoc City, Leyte, Philippines');
  });

  it('combines route and barangay/sublocality when both are present', async () => {
    const mockGeocodeResponse = {
      status: 'OK',
      results: [
        {
          formatted_address: 'Real St, Linao, Ormoc City, Leyte, Philippines',
          types: ['street_address'],
          address_components: [
            { long_name: 'Real Street', short_name: 'Real St', types: ['route'] },
            { long_name: 'Linao', short_name: 'Linao', types: ['sublocality', 'political'] },
            { long_name: 'Ormoc City', short_name: 'Ormoc City', types: ['locality', 'political'] },
          ],
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockGeocodeResponse,
    } as unknown as Response);

    const result = await reverseGeocode(11.0345, 124.6012);
    expect(result).not.toBeNull();
    expect(result?.label).toBe('Real St, Linao');
  });

  it('extracts barangay when route is missing', async () => {
    const mockGeocodeResponse = {
      status: 'OK',
      results: [
        {
          formatted_address: 'Camp Downes, Ormoc City, Leyte, Philippines',
          types: ['sublocality', 'political'],
          address_components: [
            { long_name: 'Camp Downes', short_name: 'Camp Downes', types: ['administrative_area_level_5', 'political'] },
            { long_name: 'Ormoc City', short_name: 'Ormoc City', types: ['locality', 'political'] },
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
    expect(result?.label).toBe('Camp Downes');
  });

  it('falls back safely to "Pinned location, Ormoc City" if result has only generic city without confident barangay', async () => {
    const mockGeocodeResponse = {
      status: 'OK',
      results: [
        {
          formatted_address: '2J35+XWQ Ormoc City, Leyte, Philippines',
          types: ['plus_code'],
          address_components: [
            { long_name: '2J35+XWQ', short_name: '2J35+XWQ', types: ['plus_code'] },
            { long_name: 'Ormoc City', short_name: 'Ormoc City', types: ['locality', 'political'] },
            { long_name: 'Leyte', short_name: 'Leyte', types: ['administrative_area_level_2', 'political'] },
            { long_name: 'Philippines', short_name: 'PH', types: ['country', 'political'] },
          ],
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockGeocodeResponse,
    } as unknown as Response);

    const result = await reverseGeocode(11.0049, 124.6098);
    expect(result).not.toBeNull();
    expect(result?.label).toBe('Pinned location, Ormoc City');
    expect(result?.address).toBe('Ormoc City, Leyte, Philippines');
  });
});
