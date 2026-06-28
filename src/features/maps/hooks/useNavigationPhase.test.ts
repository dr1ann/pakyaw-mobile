import { describe, expect, it, vi } from 'vitest';
import { getNavPhase, useNavigationPhase } from './useNavigationPhase';

let mockTripStatus: any = null;

vi.mock('@/stores/activeTripStore', () => ({
  useActiveTripStore: (selector: any) => selector({ trip: mockTripStatus ? { status: mockTripStatus } : null }),
}));

describe('useNavigationPhase', () => {
  describe('getNavPhase', () => {
    it('returns idle when status is request or null', () => {
      expect(getNavPhase(null)).toBe('idle');
      expect(getNavPhase('request')).toBe('idle');
    });

    it('returns to_pickup when status is accepted or driver_arriving', () => {
      expect(getNavPhase('accepted')).toBe('to_pickup');
      expect(getNavPhase('driver_arriving')).toBe('to_pickup');
    });

    it('returns at_pickup when status is driver_arrived', () => {
      expect(getNavPhase('driver_arrived')).toBe('at_pickup');
    });

    it('returns to_destination when status is in_progress', () => {
      expect(getNavPhase('in_progress')).toBe('to_destination');
    });

    it('returns ended when status is completed or cancelled', () => {
      expect(getNavPhase('completed')).toBe('ended');
      expect(getNavPhase('cancelled')).toBe('ended');
    });
  });

  describe('useNavigationPhase hook', () => {
    it('correctly maps active store state', () => {
      mockTripStatus = 'driver_arriving';
      expect(useNavigationPhase()).toBe('to_pickup');

      mockTripStatus = 'in_progress';
      expect(useNavigationPhase()).toBe('to_destination');

      mockTripStatus = null;
      expect(useNavigationPhase()).toBe('idle');
    });
  });
});
