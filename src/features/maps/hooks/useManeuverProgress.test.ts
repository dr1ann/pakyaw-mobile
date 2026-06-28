import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useManeuverProgress } from './useManeuverProgress';

let mockNavStepIndex = 0;
const mockSetNavStepIndex = vi.fn();

vi.mock('@/stores/activeTripStore', () => ({
  useActiveTripStore: (selector: any) => selector({
    navStepIndex: mockNavStepIndex,
    setNavStepIndex: mockSetNavStepIndex,
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
  };
});

describe('useManeuverProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavStepIndex = 0;
    mockCapturedEffects.length = 0;
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

  it('advances step index when close to next step start', () => {
    mockNavStepIndex = 0;
    useManeuverProgress(mockRoute, { latitude: 11.00095, longitude: 124.6000 }); // very close to pB

    // Run hook effects
    mockCapturedEffects.forEach((eff) => eff());

    expect(mockSetNavStepIndex).toHaveBeenCalledWith(1);
  });
});
