import { describe, expect, it } from 'vitest';
import {
  projectPointOnSegment,
  getMinDistanceToPolyline,
  getDistanceToStepEnd,
  getRemainingDistance,
  snapPointToPolyline,
  splitPolylineAtClosestPoint,
} from './geoProjection';

describe('geoProjection', () => {
  const pA = { lat: 11.0000, lng: 124.6000 };
  const pB = { lat: 11.0010, lng: 124.6000 };
  const pC = { lat: 11.0010, lng: 124.6010 };

  describe('projectPointOnSegment', () => {
    it('projects a point exactly on the segment line', () => {
      // Middle of A -> B
      const p = { lat: 11.0005, lng: 124.6000 };
      const proj = projectPointOnSegment(p, pA, pB);
      expect(proj.lat).toBeCloseTo(11.0005, 5);
      expect(proj.lng).toBeCloseTo(124.6000, 5);
    });

    it('projects a point off the line and snaps perpendicular', () => {
      const p = { lat: 11.0005, lng: 124.6005 };
      const proj = projectPointOnSegment(p, pA, pB);
      expect(proj.lat).toBeCloseTo(11.0005, 5);
      expect(proj.lng).toBeCloseTo(124.6000, 5);
    });

    it('snaps to start endpoint when projection is before start', () => {
      const p = { lat: 10.9995, lng: 124.6000 };
      const proj = projectPointOnSegment(p, pA, pB);
      expect(proj.lat).toBeCloseTo(11.0000, 5);
      expect(proj.lng).toBeCloseTo(124.6000, 5);
    });

    it('snaps to end endpoint when projection is after end', () => {
      const p = { lat: 11.0015, lng: 124.6000 };
      const proj = projectPointOnSegment(p, pA, pB);
      expect(proj.lat).toBeCloseTo(11.0010, 5);
      expect(proj.lng).toBeCloseTo(124.6000, 5);
    });
  });

  describe('getMinDistanceToPolyline', () => {
    it('returns distance to closest point on polyline', () => {
      const poly = [pA, pB, pC];
      const p = { lat: 11.0005, lng: 124.6005 }; // 0.0005 lng from A-B segment
      const dist = getMinDistanceToPolyline(p, poly);
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThan(100); // roughly 50m
    });
  });

  describe('snapPointToPolyline', () => {
    it('returns the closest projected point on the polyline', () => {
      const poly = [pA, pB, pC];
      const p = { lat: 11.0005, lng: 124.6005 };

      const snapped = snapPointToPolyline(p, poly);

      expect(snapped).not.toBeNull();
      expect(snapped?.lat).toBeCloseTo(11.0005, 5);
      expect(snapped?.lng).toBeCloseTo(124.6000, 5);
    });

    it('returns null when there is no route geometry', () => {
      expect(snapPointToPolyline(pA, [])).toBeNull();
    });
  });

  describe('splitPolylineAtClosestPoint', () => {
    it('splits consumed and remaining route at the closest projected point', () => {
      const poly = [pA, pB, pC];
      const p = { lat: 11.0005, lng: 124.6005 };

      const split = splitPolylineAtClosestPoint(p, poly);

      expect(split.segmentIndex).toBe(0);
      expect(split.splitPoint?.lat).toBeCloseTo(11.0005, 5);
      expect(split.splitPoint?.lng).toBeCloseTo(124.6000, 5);
      expect(split.consumed).toHaveLength(2);
      expect(split.remaining).toHaveLength(3);
      expect(split.consumed.at(-1)).toEqual(split.splitPoint);
      expect(split.remaining[0]).toEqual(split.splitPoint);
      expect(split.remaining.at(-1)).toEqual(pC);
    });

    it('does not duplicate the next vertex when the split lands exactly on it', () => {
      const poly = [pA, pB, pC];

      const split = splitPolylineAtClosestPoint(pB, poly);

      expect(split.remaining[0]).toEqual(pB);
      expect(split.remaining[1]).toEqual(pC);
    });
  });

  describe('getDistanceToStepEnd', () => {
    it('returns distance along step to the end', () => {
      const poly = [pA, pB, pC];
      const step = { polyline: poly };
      const p = { lat: 11.0005, lng: 124.6000 }; // On segment A-B
      const dist = getDistanceToStepEnd(p, step);
      
      // Should be distance from p to B + distance from B to C
      expect(dist).toBeGreaterThan(100);
    });
  });

  describe('getRemainingDistance', () => {
    it('returns remaining distance along polyline', () => {
      const poly = [pA, pB, pC];
      const p = { lat: 11.0005, lng: 124.6000 };
      const { remainingDistanceMeters, segmentIndex } = getRemainingDistance(p, poly);
      expect(segmentIndex).toBe(0);
      expect(remainingDistanceMeters).toBeGreaterThan(100);
    });
  });
});
