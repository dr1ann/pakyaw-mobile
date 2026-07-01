import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAdaptiveEtaSeconds,
  getAverageReliableSpeed,
  getRouteDurationEtaSeconds,
  useManeuverProgress,
} from './useManeuverProgress';

let mockNavStepIndex = 0;
let mockGpsSpeed: number | null = null;
let mockSpeedSamples: number[] = [];
const mockSetNavStepIndex = vi.fn();
const mockSetSpeedSamples = vi.fn();

vi.mock('@/stores/activeTripStore', () => ({
  useActiveTripStore: (selector: any) => selector({
    navStepIndex: mockNavStepIndex,
    setNavStepIndex: mockSetNavStepIndex,
    gpsSpeed: mockGpsSpeed,
  }),
}));

const mockCapturedEffects: any[] = [];
vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    useEffect: (eff: any, deps: any) => {
      mockCapturedEffects.push(eff);
    },
    useMemo: (factory: any) => factory(),
    useState: () => [mockSpeedSamples, mockSetSpeedSamples],
  };
});

describe('useManeuverProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    mockNavStepIndex = 0;
    mockGpsSpeed = null;
    mockSpeedSamples = [];
    mockCapturedEffects.length = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const pA = { lat: 11.0000, lng: 124.6000 };
  const pB = { lat: 11.0010, lng: 124.6000 };
  const pC = { lat: 11.0020, lng: 124.6000 };

  const mockRoute: any = {
    distanceMeters: 200,
    durationSeconds: 60,
    fetchedAt: 12345,
    steps: [
      {
        distanceMeters: 100,
        startLocation: pA,
        endLocation: pB,
        polyline: [pA, pB],
      },
      {
        distanceMeters: 100,
        startLocation: pB,
        endLocation: pC,
        polyline: [pB, pC],
      },
    ],
  };

  it('calculates stats correctly at start position', () => {
    const stats = useManeuverProgress(mockRoute, { latitude: pA.lat, longitude: pA.lng });
    expect(stats.distanceToManeuver).toBeGreaterThan(50);
    expect(stats.remainingDistanceMeters).toBeGreaterThan(150);
    expect(stats.etaSeconds).toBeCloseTo(63.35, 1);
  });

  it('uses measured moving-average speed for ETA when reliable', () => {
    mockSpeedSamples = [2, 2, 2];

    const stats = useManeuverProgress(mockRoute, { latitude: pA.lat, longitude: pA.lng });

    expect(stats.remainingDistanceMeters).toBeGreaterThan(150);
    expect(stats.etaSeconds).toBeCloseTo(stats.remainingDistanceMeters / 2, 2);
  });

  it('clears speed samples when the current GPS speed is unreliable', () => {
    mockGpsSpeed = null;
    mockSpeedSamples = [2, 2, 2];

    useManeuverProgress(mockRoute, { latitude: pA.lat, longitude: pA.lng });
    mockCapturedEffects.forEach((eff) => eff());

    const speedUpdater = mockSetSpeedSamples.mock.calls[0][0];
    expect(speedUpdater([2, 2, 2])).toEqual([]);
  });

  it('advances step index when close to next step start', () => {
    mockNavStepIndex = 0;
    useManeuverProgress(mockRoute, { latitude: 11.00095, longitude: 124.6000 }); // very close to pB

    // Run hook effects
    mockCapturedEffects.forEach((eff) => eff());

    expect(mockSetNavStepIndex).toHaveBeenCalledWith(1);
  });

  describe('adaptive ETA helpers', () => {
    it('calculates route-duration fallback ETA proportionally', () => {
      expect(getRouteDurationEtaSeconds(50, 200, 80)).toBe(20);
    });

    it('requires enough reliable speed samples before using speed ETA', () => {
      expect(getAverageReliableSpeed([2, 2])).toBeNull();
      expect(getAverageReliableSpeed([2, 3, 4])).toBe(3);
    });

    it('falls back to route duration when speed is unreliable', () => {
      expect(
        getAdaptiveEtaSeconds({
          remainingDistanceMeters: 50,
          totalDistanceMeters: 200,
          totalDurationSeconds: 80,
          averageSpeedMetersPerSecond: null,
        })
      ).toBe(20);
    });

    it('uses moving-average speed when reliable', () => {
      expect(
        getAdaptiveEtaSeconds({
          remainingDistanceMeters: 50,
          totalDistanceMeters: 200,
          totalDurationSeconds: 80,
          averageSpeedMetersPerSecond: 2,
        })
      ).toBe(25);
    });
  });
});
