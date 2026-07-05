import { describe, expect, it } from 'vitest';
import { lerpCoordinate } from './useInterpolatedCoordinate';

describe('useInterpolatedCoordinate', () => {
  describe('lerpCoordinate', () => {
    const from = { latitude: 11.0, longitude: 124.0 };
    const to = { latitude: 11.002, longitude: 124.004 };

    it('linearly interpolates between two coordinates', () => {
      const midpoint = lerpCoordinate(from, to, 0.5);

      expect(midpoint.latitude).toBeCloseTo(11.001);
      expect(midpoint.longitude).toBeCloseTo(124.002);
    });

    it('clamps progress below zero to avoid moving behind the start', () => {
      expect(lerpCoordinate(from, to, -0.5)).toEqual(from);
    });

    it('clamps progress above one to avoid overshooting the target', () => {
      expect(lerpCoordinate(from, to, 1.5)).toEqual(to);
    });
  });
});
