import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRideCameraController } from './useRideCameraController';

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

describe('useRideCameraController', () => {
  let capturedEffect: any = null;
  let isMapReady = false;
  const setIsMapReady = vi.fn();
  let userPanned = false;
  const setUserPanned = vi.fn();
  let queuedCommandRef = { current: null };
  let lastExecutedCommandRef = { current: '' };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedEffect = null;
    isMapReady = false;
    userPanned = false;
    queuedCommandRef = { current: null };
    lastExecutedCommandRef = { current: '' };

    let stateCallCount = 0;
    mockUseState.mockImplementation((init) => {
      const count = stateCallCount++;
      if (count === 0) {
        return [isMapReady, setIsMapReady];
      }
      return [userPanned, setUserPanned];
    });

    mockUseEffect.mockImplementation((effect) => {
      capturedEffect = effect;
    });

    let refCallCount = 0;
    mockUseRef.mockImplementation((init) => {
      const count = refCallCount++;
      if (count === 0) return queuedCommandRef;
      return lastExecutedCommandRef;
    });
  });

  it('initializes and handles map ready', () => {
    const mapRef = { current: null };
    const inputs = {
      pickupLocation: null,
      destinationLocation: null,
      driverLocation: null,
      ownLocation: null,
      phase: 'booking' as const,
    };

    const controller = useRideCameraController(mapRef as any, inputs);
    expect(controller.userPanned).toBe(false);

    controller.onMapReady();
    expect(setIsMapReady).toHaveBeenCalledWith(true);
  });

  it('sets user panned when onUserPan is called', () => {
    const mapRef = { current: null };
    const inputs = {
      pickupLocation: null,
      destinationLocation: null,
      driverLocation: null,
      ownLocation: null,
      phase: 'booking' as const,
    };

    const controller = useRideCameraController(mapRef as any, inputs);
    controller.onUserPan();
    expect(setUserPanned).toHaveBeenCalledWith(true);
  });

  it('resets user panned when recenter is called', () => {
    const mapRef = { current: null };
    const inputs = {
      pickupLocation: null,
      destinationLocation: null,
      driverLocation: null,
      ownLocation: null,
      phase: 'booking' as const,
    };

    const controller = useRideCameraController(mapRef as any, inputs);
    controller.recenter();
    expect(setUserPanned).toHaveBeenCalledWith(false);
  });

  it('queues command if map is not ready', () => {
    const animateToRegionMock = vi.fn();
    const mapRef = { current: { animateToRegion: animateToRegionMock } };
    const inputs = {
      pickupLocation: { latitude: 11.0, longitude: 124.0 },
      destinationLocation: null,
      driverLocation: null,
      ownLocation: null,
      phase: 'booking' as const,
    };

    useRideCameraController(mapRef as any, inputs);

    // Trigger effect
    capturedEffect();

    // Should queue the centerOn command because isMapReady is false
    expect(queuedCommandRef.current).toEqual({
      type: 'centerOn',
      coordinate: { latitude: 11.0, longitude: 124.0 },
    });
    expect(animateToRegionMock).not.toHaveBeenCalled();
  });

  it('executes queued command when map becomes ready', () => {
    const animateToRegionMock = vi.fn();
    const mapRef = { current: { animateToRegion: animateToRegionMock } };
    const inputs = {
      pickupLocation: { latitude: 11.0, longitude: 124.0 },
      destinationLocation: null,
      driverLocation: null,
      ownLocation: null,
      phase: 'booking' as const,
    };

    const controller = useRideCameraController(mapRef as any, inputs);

    // Trigger effect (queues command)
    capturedEffect();

    // Now call onMapReady
    isMapReady = true;
    controller.onMapReady();

    expect(animateToRegionMock).toHaveBeenCalledWith(
      {
        latitude: 11.0,
        longitude: 124.0,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      1000
    );
    expect(queuedCommandRef.current).toBeNull();
  });

  it('replays the current camera command when a remounted map becomes ready', () => {
    const fitToCoordinatesMock = vi.fn();
    const mapRef = { current: { fitToCoordinates: fitToCoordinatesMock } };
    const inputs = {
      pickupLocation: { latitude: 11.0, longitude: 124.0 },
      destinationLocation: { latitude: 11.1, longitude: 124.1 },
      driverLocation: null,
      ownLocation: null,
      phase: 'booking' as const,
    };
    const expectedCommand = {
      type: 'fit',
      coordinates: [inputs.pickupLocation, inputs.destinationLocation],
    };
    lastExecutedCommandRef.current = `${JSON.stringify(expectedCommand)}_pad_320`;

    const controller = useRideCameraController(mapRef as any, inputs);
    controller.onMapReady();

    expect(fitToCoordinatesMock).toHaveBeenCalledWith(
      [inputs.pickupLocation, inputs.destinationLocation],
      {
        edgePadding: {
          top: 120,
          right: 80,
          bottom: 320,
          left: 80,
        },
        animated: true,
      }
    );
  });

  it('reframes the route when a remounted map is ready after user pan state', () => {
    userPanned = true;
    const fitToCoordinatesMock = vi.fn();
    const mapRef = { current: { fitToCoordinates: fitToCoordinatesMock } };
    const inputs = {
      pickupLocation: { latitude: 11.0, longitude: 124.0 },
      destinationLocation: { latitude: 11.1, longitude: 124.1 },
      driverLocation: null,
      ownLocation: { latitude: 10.9, longitude: 123.9 },
      phase: 'booking' as const,
    };

    const controller = useRideCameraController(mapRef as any, inputs);
    controller.onMapReady();

    expect(setUserPanned).toHaveBeenCalledWith(false);
    expect(fitToCoordinatesMock).toHaveBeenCalledWith(
      [inputs.pickupLocation, inputs.destinationLocation],
      {
        edgePadding: {
          top: 120,
          right: 80,
          bottom: 320,
          left: 80,
        },
        animated: true,
      }
    );
  });
});
