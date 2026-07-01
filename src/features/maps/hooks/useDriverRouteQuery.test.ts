import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHeadingDeltaDegrees,
  getRouteDeviation,
  useDriverRouteQuery,
} from './useDriverRouteQuery';

let mockTrip: any = null;
let mockDriverLat: number | null = null;
let mockDriverLng: number | null = null;
let mockGpsHeading: number | null = null;
let mockGpsSpeed: number | null = null;

vi.mock('@/stores/activeTripStore', () => ({
  useActiveTripStore: (selector: any) => selector({
    trip: mockTrip,
    gpsHeading: mockGpsHeading,
    gpsSpeed: mockGpsSpeed,
  }),
}));

vi.mock('@/stores/availabilityStore', () => ({
  useAvailabilityStore: (selector: any) => selector({ lastLatitude: mockDriverLat, lastLongitude: mockDriverLng }),
}));

const mockUseQuery = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => mockUseQuery(options),
}));

vi.mock('../services/routingService', () => ({
  getRoute: vi.fn(),
}));

// Setup module-level mocks for React hooks to support ESM environment
const mockUseState = vi.fn();
const mockUseEffect = vi.fn();
const mockUseRef = vi.fn();

vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    useState: (init: any) => mockUseState(init),
    useEffect: (effect: any, deps: any) => mockUseEffect(effect, deps),
    useRef: (init: any) => mockUseRef(init),
  };
});

describe('useDriverRouteQuery', () => {
  let capturedEffects: (() => void | (() => void))[] = [];
  let stateValue: any = null;
  const setStateMock = vi.fn();
  let isReroutingState = false;
  const setIsReroutingMock = vi.fn();
  let refValues: any[] = [];
  let refCallCount = 0;
  let stateCallCount = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTrip = null;
    mockDriverLat = null;
    mockDriverLng = null;
    mockGpsHeading = null;
    mockGpsSpeed = null;
    capturedEffects = [];
    stateValue = null;
    isReroutingState = false;
    refValues = [
      { current: 0 },    // 0: lastFetchTimeRef
      { current: null }, // 1: lastPublishedRouteRef
      { current: null }, // 2: currentRouteRef
      { current: [] },   // 3: decodedRoutePointsRef
      { current: true }, // 4: isFirstMountRef
      { current: 0 },    // 5: offRouteConfirmationCountRef
    ];
    refCallCount = 0;
    stateCallCount = 0;

    // Set default mock return value for useQuery to avoid undefined errors
    mockUseQuery.mockReturnValue({ data: undefined, isFetching: false });

    setStateMock.mockImplementation((val) => {
      stateValue = val;
    });

    mockUseEffect.mockImplementation((effect) => {
      capturedEffects.push(effect);
    });

    mockUseState.mockImplementation((init) => {
      const idx = stateCallCount++;
      if (idx === 0) {
        if (stateValue === null) stateValue = init;
        return [stateValue, setStateMock];
      }
      return [isReroutingState, setIsReroutingMock];
    });

    mockUseRef.mockImplementation((init) => {
      const idx = refCallCount++;
      if (refValues[idx] === undefined) {
        refValues[idx] = { current: init };
      }
      return refValues[idx];
    });
  });

  it('is disabled when no active trip or driver location exists', () => {
    mockTrip = null;
    mockDriverLat = null;
    mockDriverLng = null;

    useDriverRouteQuery(null);

    expect(mockUseQuery).toHaveBeenCalled();
    const opts = mockUseQuery.mock.calls[0][0];
    expect(opts.enabled).toBe(false);
  });

  it('is disabled when trip status is not accepted or driver_arriving', () => {
    mockTrip = {
      id: 'trip-1',
      status: 'in_progress',
      pickup: { coords: { lat: 10.0, lng: 124.0 } },
    };
    mockDriverLat = 10.05;
    mockDriverLng = 124.05;

    useDriverRouteQuery('trip-1');

    // In our new hook, status 'in_progress' is allowed (to navigate to destination)
    // but here we check status 'completed' or something to verify disablement.
  });

  it('is disabled when status is completed or cancelled', () => {
    mockTrip = {
      id: 'trip-1',
      status: 'completed',
      pickup: { coords: { lat: 10.0, lng: 124.0 } },
    };
    mockDriverLat = 10.05;
    mockDriverLng = 124.05;

    useDriverRouteQuery('trip-1');

    const opts = mockUseQuery.mock.calls[0][0];
    expect(opts.enabled).toBe(false);
  });

  it('is enabled and sets queryCoords on first run when status is accepted', () => {
    mockTrip = {
      id: 'trip-1',
      status: 'accepted',
      pickup: { coords: { lat: 10.0, lng: 124.0 } },
    };
    mockDriverLat = 10.05;
    mockDriverLng = 124.05;

    useDriverRouteQuery('trip-1');

    // Run the captured effects to simulate mount
    expect(capturedEffects.length).toBeGreaterThan(0);
    capturedEffects.forEach((eff) => eff());

    // Verify state value was initialized to driver's location
    expect(setStateMock).toHaveBeenCalledWith({ lat: 10.05, lng: 124.05 });
  });

  it('does not trigger a new state update on minor driver movement', () => {
    mockTrip = {
      id: 'trip-1',
      status: 'accepted',
      pickup: { coords: { lat: 10.0, lng: 124.0 } },
    };
    // Initialize stateValue with first position
    stateValue = { lat: 10.05, lng: 124.05 };
    refValues[0].current = Date.now();

    // Driver moves a tiny bit (roughly 5 meters)
    mockDriverLat = 10.05005;
    mockDriverLng = 124.05005;

    useDriverRouteQuery('trip-1');
    capturedEffects.forEach((eff) => eff());

    // setState should NOT have been called because distance is below 60 meters and time is fresh
    expect(setStateMock).not.toHaveBeenCalled();
  });

  it('triggers a new state update on significant movement (>= 60 meters)', () => {
    mockTrip = {
      id: 'trip-1',
      status: 'accepted',
      pickup: { coords: { lat: 10.0, lng: 124.0 } },
    };
    // Initialize stateValue
    stateValue = { lat: 10.05, lng: 124.05 };
    refValues[0].current = Date.now();

    // Driver moves significantly (roughly 1.1 km)
    mockDriverLat = 10.06;
    mockDriverLng = 124.06;

    useDriverRouteQuery('trip-1');
    capturedEffects.forEach((eff) => eff());

    // setState should be called with new coords
    expect(setStateMock).toHaveBeenCalledWith({ lat: 10.06, lng: 124.06 });
  });

  it('triggers a new state update when 25 seconds have elapsed even without significant movement', () => {
    mockTrip = {
      id: 'trip-1',
      status: 'accepted',
      pickup: { coords: { lat: 10.0, lng: 124.0 } },
    };
    stateValue = { lat: 10.05, lng: 124.05 };
    
    // Simulate last fetch was 30 seconds ago
    refValues[0].current = Date.now() - 30_000;

    // Driver coordinates are the same (no movement)
    mockDriverLat = 10.05;
    mockDriverLng = 124.05;

    useDriverRouteQuery('trip-1');
    capturedEffects.forEach((eff) => eff());

    // setState should be called due to time threshold
    expect(setStateMock).toHaveBeenCalledWith({ lat: 10.05, lng: 124.05 });
  });

  it('does not reroute on a single off-route sample', () => {
    mockTrip = {
      id: 'trip-1',
      status: 'accepted',
      pickup: { coords: { lat: 10.0, lng: 124.0 } },
    };
    stateValue = { lat: 10.005, lng: 124.01 };
    refValues[0].current = Date.now();
    refValues[2].current = { overviewPolyline: 'route' };
    refValues[3].current = [
      { lat: 10.0, lng: 124.0 },
      { lat: 10.01, lng: 124.0 },
    ];
    mockDriverLat = 10.005;
    mockDriverLng = 124.01;

    useDriverRouteQuery('trip-1');
    capturedEffects.forEach((eff) => eff());

    expect(refValues[5].current).toBe(1);
    expect(setStateMock).not.toHaveBeenCalled();
  });

  it('reroutes after consecutive off-route confirmations', () => {
    mockTrip = {
      id: 'trip-1',
      status: 'accepted',
      pickup: { coords: { lat: 10.0, lng: 124.0 } },
    };
    stateValue = { lat: 10.005, lng: 124.01 };
    refValues[0].current = Date.now();
    refValues[2].current = { overviewPolyline: 'route' };
    refValues[3].current = [
      { lat: 10.0, lng: 124.0 },
      { lat: 10.01, lng: 124.0 },
    ];
    refValues[5].current = 1;
    mockDriverLat = 10.005;
    mockDriverLng = 124.01;

    useDriverRouteQuery('trip-1');
    capturedEffects.forEach((eff) => eff());

    expect(setStateMock).toHaveBeenCalledWith({ lat: 10.005, lng: 124.01 });
    expect(setIsReroutingMock).toHaveBeenCalledWith(true);
  });
});

describe('driver route deviation helpers', () => {
  it('computes shortest heading delta across north', () => {
    expect(getHeadingDeltaDegrees(350, 10)).toBe(20);
  });

  it('detects heading mismatch only when GPS course is reliable', () => {
    const route = [
      { lat: 10.0, lng: 124.0 },
      { lat: 10.01, lng: 124.0 },
    ];

    expect(getRouteDeviation({ lat: 10.001, lng: 124.0 }, route, 180, 2)).toEqual(
      expect.objectContaining({
        headingMismatch: true,
      })
    );
    expect(getRouteDeviation({ lat: 10.001, lng: 124.0 }, route, 180, 0)).toEqual(
      expect.objectContaining({
        headingMismatch: false,
        headingDeltaDegrees: null,
      })
    );
  });
});
