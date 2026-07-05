import { describe, expect, it } from 'vitest';
import { decodePolyline } from './decodePolyline';

describe('decodePolyline', () => {
  it('decodes an empty polyline to an empty array', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  it('decodes a single point polyline', () => {
    // Coordinate: (38.5, -120.2)
    // Encoded: _p~iF~ps|U
    const result = decodePolyline('_p~iF~ps|U');
    expect(result).toHaveLength(1);
    expect(result[0].lat).toBeCloseTo(38.5, 5);
    expect(result[0].lng).toBeCloseTo(-120.2, 5);
  });

  it('decodes a multi-point Google encoded polyline correctly', () => {
    // Coordinates: (38.5, -120.2) -> (40.7, -120.95) -> (43.252, -126.453)
    // Encoded: _p~iF~ps|U_ulLnnqC_mqNvxq`@
    const result = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(result).toHaveLength(3);

    expect(result[0].lat).toBeCloseTo(38.5, 5);
    expect(result[0].lng).toBeCloseTo(-120.2, 5);

    expect(result[1].lat).toBeCloseTo(40.7, 5);
    expect(result[1].lng).toBeCloseTo(-120.95, 5);

    expect(result[2].lat).toBeCloseTo(43.252, 5);
    expect(result[2].lng).toBeCloseTo(-126.453, 5);
  });
});
