import { describe, expect, it } from 'vitest';

import { geohashNeighbors, geohashOf, haversineMeters } from '@pakyaw/shared/lib/geo';

describe('geo.haversineMeters', () => {
  it('returns zero for identical points', () => {
    const p = { lat: 14.5995, lng: 120.9842 };
    expect(haversineMeters(p, p)).toBe(0);
  });

  it('approximates ~111km for one degree of latitude at the equator', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 1, lng: 0 };
    const d = haversineMeters(a, b);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('is symmetric', () => {
    const a = { lat: 14.5995, lng: 120.9842 };
    const b = { lat: 14.61, lng: 120.99 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe('geo.geohashOf', () => {
  it('produces a 7-char base32 hash by default', () => {
    const hash = geohashOf({ lat: 14.5995, lng: 120.9842 });
    expect(hash).toHaveLength(7);
    expect(hash).toMatch(/^[0-9bcdefghjkmnpqrstuvwxyz]+$/);
  });

  it('honors the precision argument', () => {
    expect(geohashOf({ lat: 14.5995, lng: 120.9842 }, 5)).toHaveLength(5);
    expect(geohashOf({ lat: 14.5995, lng: 120.9842 }, 9)).toHaveLength(9);
  });

  it('shares a prefix for nearby points', () => {
    const a = geohashOf({ lat: 14.5995, lng: 120.9842 }, 5);
    const b = geohashOf({ lat: 14.5998, lng: 120.9845 }, 5);
    expect(a.slice(0, 4)).toBe(b.slice(0, 4));
  });

  it('rejects precision outside [1,12]', () => {
    expect(() => geohashOf({ lat: 0, lng: 0 }, 0)).toThrow();
    expect(() => geohashOf({ lat: 0, lng: 0 }, 13)).toThrow();
  });
});

describe('geo.geohashNeighbors', () => {
  it('returns the center cell as the first element', () => {
    const result = geohashNeighbors('wcbwd');
    expect(result[0]).toBe('wcbwd');
  });

  it('returns 9 unique cells for a typical interior cell', () => {
    const result = geohashNeighbors('wcbwd');
    expect(result.length).toBe(9);
    expect(new Set(result).size).toBe(9);
  });

  it('includes the eastern neighbor wcbwe for driver cell wcbwd', () => {
    const result = geohashNeighbors('wcbwd');
    expect(result).toContain('wcbwe');
  });

  it('all neighbors share the same precision as input', () => {
    const result = geohashNeighbors('wcbwd');
    for (const h of result) {
      expect(h).toHaveLength(5);
    }
  });

  it('deduplicates when neighbors wrap to the same cell', () => {
    const result = geohashNeighbors('b');
    expect(result.length).toBe(new Set(result).size);
  });
});
