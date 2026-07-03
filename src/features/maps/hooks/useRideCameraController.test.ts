import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRideCameraController } from './useRideCameraController';
import { useUiStore } from '@/stores/uiStore';

const mockUseState = vi.fn();
const mockUseEffect = vi.fn();
const mockUseRef = vi.fn();
let mockCameraFollowing = true;
const mockSetCameraFollowing = vi.fn((cameraFollowing: boolean) => {
  mockCameraFollowing = cameraFollowing;
});

vi.mock('@/stores/activeTripStore', () => ({
  useActiveTripStore: Object.assign(
    (selector: any) =>
      selector({
        cameraFollowing: mockCameraFollowing,
        setCameraFollowing: mockSetCameraFollowing,
      }),
    {
      getState: () => ({
        cameraFollowing: mockCameraFollowing,
        setCameraFollowing: mockSetCameraFollowing,
      }),
    }
  ),
}));

vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    useState: (init: any) => mockUseState(init),
    useEffect: (effect: any, deps: any) => mockUseEffect(effect, deps),
    useRef: (init: any) => mockUseRef(init),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  InteractionManager: {
    runAfterInteractions: vi.fn((cb: () => void) => cb()),
  },
}));

describe('useRideCameraController', () => {
  let capturedEffect: any = null;
  let capturedEffects: any[] = [];
  let isMapReady = false;
  const setIsMapReady = vi.fn();
  let queuedCommandRef = { current: null };
  let lastExecutedCommandRef = { current: '' };
  let hasExecutedNavigationFollowRef = { current: false };
  let prevNavEnabledRef = { current: false };
  let appStateRef = { current: 'active' as string };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedEffect = null;
    capturedEffects = [];
    isMapReady = false;
    mockCameraFollowing = true;
    mockSetCameraFollowing.mockClear();
    queuedCommandRef = { current: null };
    lastExecutedCommandRef = { current: '' };
    hasExecutedNavigationFollowRef = { current: false };
    prevNavEnabledRef = { current: false };
    appStateRef = { current: 'active' };
    useUiStore.getState().resetPip();

    mockUseState.mockImplementation((init) => {
      return [isMapReady, setIsMapReady];
    });

    mockUseEffect.mockImplementation((effect) => {
      capturedEffects.push(effect);
      capturedEffect = effect;
    });

    let refCallCount = 0;
    mockUseRef.mockImplementation((init) => {
      const count = refCallCount++;
      if (count === 0) return queuedCommandRef;
      if (count === 1) return lastExecutedCommandRef;
      if (count === 2) return { current: 0 };
      if (count === 3) return hasExecutedNavigationFollowRef;
      if (count === 4) return prevNavEnabledRef;
      return appStateRef;
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
    expect(mockSetCameraFollowing).toHaveBeenCalledWith(false);
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
    expect(mockSetCameraFollowing).toHaveBeenCalledWith(true);
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
    mockCameraFollowing = false;
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

    expect(mockSetCameraFollowing).toHaveBeenCalledWith(true);
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

  it('aims the navigation camera directly at the driver (off-center anchor handled by mapPadding)', () => {
    isMapReady = true;
    const animateCameraMock = vi.fn();
    const mapRef = { current: { animateCamera: animateCameraMock } };
    const driverCoordinate = { latitude: 11.0, longitude: 124.0 };
    const inputs = {
      pickupLocation: null,
      destinationLocation: { latitude: 11.1, longitude: 124.1 },
      driverLocation: driverCoordinate,
      ownLocation: driverCoordinate,
      phase: 'active' as const,
      navigation: {
        enabled: true,
        coordinate: driverCoordinate,
        heading: 0,
      },
    };

    useRideCameraController(mapRef as any, inputs);
    capturedEffect();

    expect(animateCameraMock).toHaveBeenCalledOnce();
    const [camera, options] = animateCameraMock.mock.calls[0];
    expect(camera.heading).toBe(0);
    expect(camera.pitch).toBe(50);
    expect(camera.zoom).toBe(19.1);
    expect(camera.altitude).toBe(180);
    // Camera target is now the driver coordinate itself; the "driver near the
    // bottom, road ahead" framing is achieved via mapPadding on <MapView/>.
    expect(camera.center.latitude).toBe(driverCoordinate.latitude);
    expect(camera.center.longitude).toBe(driverCoordinate.longitude);
    expect(options).toEqual({ duration: 600 });
  });

  it('allows navigation camera duration to be driven by the caller', () => {
    isMapReady = true;
    const animateCameraMock = vi.fn();
    const mapRef = { current: { animateCamera: animateCameraMock } };
    const driverCoordinate = { latitude: 11.0, longitude: 124.0 };
    const inputs = {
      pickupLocation: null,
      destinationLocation: { latitude: 11.1, longitude: 124.1 },
      driverLocation: driverCoordinate,
      ownLocation: driverCoordinate,
      phase: 'active' as const,
      navigation: {
        enabled: true,
        coordinate: driverCoordinate,
        heading: 0,
        animationDurationMs: 0,
      },
    };

    useRideCameraController(mapRef as any, inputs);
    capturedEffect();

    expect(animateCameraMock).toHaveBeenCalledOnce();
    expect(animateCameraMock.mock.calls[0][1]).toEqual({ duration: 600 });
  });

  it('reacquires navigation camera even when the same command was executed in a prior booking', () => {
    isMapReady = true;
    const animateCameraMock = vi.fn();
    const mapRef = { current: { animateCamera: animateCameraMock } };
    const driverCoordinate = { latitude: 11.0, longitude: 124.0 };
    const expectedCommand = {
      type: 'navigationFollow',
      coordinate: driverCoordinate,
      heading: 0,
      zoom: 19.1,
      pitch: 50,
      altitude: 180,
      animationDurationMs: 600,
    };
    lastExecutedCommandRef.current = `${JSON.stringify(expectedCommand)}_pad_320`;
    const inputs = {
      pickupLocation: null,
      destinationLocation: { latitude: 11.1, longitude: 124.1 },
      driverLocation: driverCoordinate,
      ownLocation: driverCoordinate,
      phase: 'active' as const,
      navigation: {
        enabled: true,
        coordinate: driverCoordinate,
        heading: 0,
      },
    };

    useRideCameraController(mapRef as any, inputs);
    capturedEffect();

    expect(animateCameraMock).toHaveBeenCalledOnce();
  });

  it('engages the navigation camera immediately even when a stale pan latch exists', () => {
    isMapReady = true;
    mockCameraFollowing = false;
    const animateCameraMock = vi.fn();
    const mapRef = { current: { animateCamera: animateCameraMock } };
    const driverCoordinate = { latitude: 11.0, longitude: 124.0 };
    const inputs = {
      pickupLocation: null,
      destinationLocation: { latitude: 11.1, longitude: 124.1 },
      driverLocation: driverCoordinate,
      ownLocation: driverCoordinate,
      phase: 'active' as const,
      navigation: {
        enabled: true,
        coordinate: driverCoordinate,
        heading: 0,
        animationDurationMs: 0,
      },
    };

    useRideCameraController(mapRef as any, inputs);
    capturedEffect();

    expect(mockSetCameraFollowing).toHaveBeenCalledWith(true);
    expect(animateCameraMock).toHaveBeenCalledOnce();
    expect(animateCameraMock.mock.calls[0][1]).toEqual({ duration: 600 });
    expect(hasExecutedNavigationFollowRef.current).toBe(true);
  });

  it('keeps the first navigation engagement animation until a coordinate is available', () => {
    isMapReady = true;
    prevNavEnabledRef = { current: true };
    hasExecutedNavigationFollowRef = { current: false };
    const animateCameraMock = vi.fn();
    const mapRef = { current: { animateCamera: animateCameraMock } };
    const driverCoordinate = { latitude: 11.0, longitude: 124.0 };

    useRideCameraController(mapRef as any, {
      pickupLocation: null,
      destinationLocation: { latitude: 11.1, longitude: 124.1 },
      driverLocation: driverCoordinate,
      ownLocation: driverCoordinate,
      phase: 'active' as const,
      navigation: {
        enabled: true,
        coordinate: driverCoordinate,
        heading: 0,
        animationDurationMs: 0,
      },
    });
    capturedEffect();

    expect(animateCameraMock).toHaveBeenCalledOnce();
    expect(animateCameraMock.mock.calls[0][1]).toEqual({ duration: 600 });
  });

  it('recenters immediately without waiting for the store rerender', () => {
    isMapReady = true;
    mockCameraFollowing = false;
    prevNavEnabledRef = { current: true };
    hasExecutedNavigationFollowRef = { current: true };
    const animateCameraMock = vi.fn();
    const mapRef = { current: { animateCamera: animateCameraMock } };
    const driverCoordinate = { latitude: 11.0, longitude: 124.0 };
    const inputs = {
      pickupLocation: null,
      destinationLocation: { latitude: 11.1, longitude: 124.1 },
      driverLocation: driverCoordinate,
      ownLocation: driverCoordinate,
      phase: 'active' as const,
      navigation: {
        enabled: true,
        coordinate: driverCoordinate,
        heading: 0,
        animationDurationMs: 0,
      },
    };

    const controller = useRideCameraController(mapRef as any, inputs);
    controller.recenter();

    expect(mockSetCameraFollowing).toHaveBeenCalledWith(true);
    expect(animateCameraMock).toHaveBeenCalledOnce();
    expect(animateCameraMock.mock.calls[0][1]).toEqual({ duration: 0 });
  });

  it('does not execute navigation camera commands while Android PiP is active', () => {
    useUiStore.getState().setPipState({ isInPip: true, isSupported: true });
    isMapReady = true;
    const animateCameraMock = vi.fn();
    const mapRef = { current: { animateCamera: animateCameraMock } };
    const driverCoordinate = { latitude: 11.0, longitude: 124.0 };
    const inputs = {
      pickupLocation: null,
      destinationLocation: { latitude: 11.1, longitude: 124.1 },
      driverLocation: driverCoordinate,
      ownLocation: driverCoordinate,
      phase: 'active' as const,
      navigation: {
        enabled: true,
        coordinate: driverCoordinate,
        heading: 0,
      },
    };

    useRideCameraController(mapRef as any, inputs);
    capturedEffect();

    expect(animateCameraMock).not.toHaveBeenCalled();
  });

  it('queues camera commands while AppState is not active (Frustum NPE guard)', () => {
    isMapReady = true;
    appStateRef = { current: 'background' };
    const fitToCoordinatesMock = vi.fn();
    const animateCameraMock = vi.fn();
    const mapRef = {
      current: {
        fitToCoordinates: fitToCoordinatesMock,
        animateCamera: animateCameraMock,
      },
    };
    const inputs = {
      pickupLocation: { latitude: 11.0, longitude: 124.0 },
      destinationLocation: { latitude: 11.1, longitude: 124.1 },
      driverLocation: null,
      ownLocation: null,
      phase: 'booking' as const,
    };

    useRideCameraController(mapRef as any, inputs);
    capturedEffect();

    expect(fitToCoordinatesMock).not.toHaveBeenCalled();
    expect(animateCameraMock).not.toHaveBeenCalled();
    expect(queuedCommandRef.current).toEqual({
      type: 'fit',
      coordinates: [inputs.pickupLocation, inputs.destinationLocation],
    });
  });

  it('drains the queued command when AppState returns to active', async () => {
    isMapReady = true;
    appStateRef = { current: 'background' };
    const fitToCoordinatesMock = vi.fn();
    const mapRef = { current: { fitToCoordinates: fitToCoordinatesMock } };
    const inputs = {
      pickupLocation: { latitude: 11.0, longitude: 124.0 },
      destinationLocation: { latitude: 11.1, longitude: 124.1 },
      driverLocation: null,
      ownLocation: null,
      phase: 'booking' as const,
    };

    // Stub global rAF to run synchronously (vitest's node env doesn't
    // provide it). Set on globalThis to make sure the global lookup hits.
    const originalRaf = (globalThis as any).requestAnimationFrame;
    (globalThis as any).requestAnimationFrame = (cb: any) => {
      cb();
      return 0;
    };

    try {
      useRideCameraController(mapRef as any, inputs);

      // Run the AppState effect (first captured) — registers the listener.
      const appStateEffect = capturedEffects[0];
      appStateEffect();
      // Run the main camera effect — queues the command (gated).
      capturedEffect();
      expect(fitToCoordinatesMock).not.toHaveBeenCalled();
      expect(queuedCommandRef.current).not.toBeNull();

      // Pull the listener registered with AppState.addEventListener.
      const RN = await import('react-native');
      const calls = (RN.AppState.addEventListener as any).mock.calls as any[];
      const changeCall = calls.find((c) => c[0] === 'change');
      expect(changeCall, 'AppState change listener should be registered').toBeTruthy();
      const listener = changeCall![1] as (s: string) => void;

      // Simulate AppState → active. Listener flips appStateRef and schedules
      // the drain via rAF → rAF → InteractionManager; both are stubbed
      // synchronously so by the time this call returns the drain has run.
      listener('active');

      expect(fitToCoordinatesMock).toHaveBeenCalledTimes(1);
      expect(queuedCommandRef.current).toBeNull();
    } finally {
      (globalThis as any).requestAnimationFrame = originalRaf;
    }
  });

  it('centers on the driver navigation coordinate when phase is terminal', () => {
    isMapReady = true;
    const animateToRegionMock = vi.fn();
    const mapRef = { current: { animateToRegion: animateToRegionMock } };
    const driverCoordinate = { latitude: 11.2, longitude: 124.2 };
    const inputs = {
      pickupLocation: { latitude: 11.0, longitude: 124.0 },
      destinationLocation: { latitude: 11.1, longitude: 124.1 },
      driverLocation: driverCoordinate,
      ownLocation: driverCoordinate,
      phase: 'terminal' as const,
      navigation: {
        enabled: false,
        coordinate: null,
        heading: null,
      },
    };

    useRideCameraController(mapRef as any, inputs);
    capturedEffect();

    // Terminal phase re-centers on the driver position used during navigation
    // — restoring overview zoom, pitch=0 and heading=0 via animateToRegion —
    // so the camera is consistent with the rest of the nav system.
    expect(animateToRegionMock).toHaveBeenCalledWith(
      {
        latitude: driverCoordinate.latitude,
        longitude: driverCoordinate.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      1000
    );
  });

  it('clears the user-pan latch on the falling edge of navigation', () => {
    isMapReady = true;
    mockCameraFollowing = false;
    prevNavEnabledRef = { current: true };
    const animateToRegionMock = vi.fn();
    const mapRef = { current: { animateToRegion: animateToRegionMock } };
    const driverCoordinate = { latitude: 11.2, longitude: 124.2 };
    const inputs = {
      pickupLocation: null,
      destinationLocation: null,
      driverLocation: driverCoordinate,
      ownLocation: driverCoordinate,
      phase: 'terminal' as const,
      navigation: {
        enabled: false,
        coordinate: null,
        heading: null,
      },
    };

    useRideCameraController(mapRef as any, inputs);
    capturedEffect();

    // Falling edge from nav-enabled → nav-disabled clears the pan latch so the
    // terminal-phase command isn't suppressed by a stale pan from in_progress.
    expect(mockSetCameraFollowing).toHaveBeenCalledWith(true);
  });
});
