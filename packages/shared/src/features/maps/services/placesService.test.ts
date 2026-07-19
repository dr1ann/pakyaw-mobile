import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reverseGeocode } from './placesService';

global.fetch = vi.fn();

describe('placesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reverseGeocode', () => {
    it('cleans plus codes and extracts label correctly for Ormoc addresses', async () => {
      const mockResponse = {
        status: 'OK',
        results: [
          {
            formatted_address: '8F2V+3X Ormoc, Leyte, Philippines',
            address_components: [
              { long_name: '8F2V+3X', short_name: '8F2V+3X', types: ['plus_code'] },
              { long_name: 'Real Street', short_name: 'Real St', types: ['route'] },
              { long_name: 'Barangay 1', short_name: 'Brgy 1', types: ['administrative_area_level_5'] },
              { long_name: 'Ormoc', short_name: 'Ormoc', types: ['locality'] },
            ],
            types: ['plus_code'],
          },
          {
            formatted_address: 'Real St, Barangay 1, Ormoc, Leyte, Philippines',
            address_components: [
              { long_name: 'Real Street', short_name: 'Real St', types: ['route'] },
              { long_name: 'Barangay 1', short_name: 'Brgy 1', types: ['administrative_area_level_5'] },
              { long_name: 'Ormoc', short_name: 'Ormoc', types: ['locality'] },
            ],
            types: ['street_address'],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await reverseGeocode(11.003, 124.607);

      expect(result).not.toBeNull();
      expect(result?.address).toBe('Real St, Barangay 1, Ormoc, Leyte, Philippines');
      expect(result?.label).toBe('Real St, Brgy 1');
      expect(result?.coords).toEqual({ lat: 11.003, lng: 124.607 });
    });

    it('returns null on fetch failure or non-OK status', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await reverseGeocode(11.003, 124.607);
      expect(result).toBeNull();
    });
  });
});
