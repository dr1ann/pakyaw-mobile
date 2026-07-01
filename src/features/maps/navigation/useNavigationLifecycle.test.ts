import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAvailabilityStore } from '@/stores/availabilityStore';
import { useActiveTripStore } from '@/stores/activeTripStore';
import { DRIVER_LAST_BACKGROUND_LOCATION_KEY } from '@/features/driver-availability/services/location.service';
import { useNavigationLifecycle } from './useNavigationLifecycle';

vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    useEffect: (effect: () => void | (() => void)) => effect(),
    useRef: (initialValue: unknown) => ({ current: initialValue }),
  };
});

let appStateListener: ((nextState: string) => void) | null = null;

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn((_event, listener) => {
      appStateListener = listener;
      return { remove: vi.fn() };
    }),
  },
}));

vi.mock('expo-location', () => ({
  Accuracy: {
    BestForNavigation: 6,
  },
  getCurrentPositionAsync: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@/features/driver-availability/services/location.service', () => ({
  DRIVER_LAST_BACKGROUND_LOCATION_KEY: 'pakyaw:last-bg-location',
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('useNavigationLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appStateListener = null;
    useActiveTripStore.setState({
      tripId: 'trip-1',
      trip: null,
      driverLocation: null,
      navHeading: null,
      gpsHeading: null,
      gpsSpeed: null,
      navStepIndex: 0,
      navActiveStatus: 'in_progress',
      navSession: null,
      cameraFollowing: true,
    });
    useAvailabilityStore.setState({
      availability: 'on_trip',
      lastLatitude: null,
      lastLongitude: null,
      incomingRequests: [],
    });
  });

  it('stamps background state and restores navigation on foreground', async () => {
    const forceFollow = vi.fn();
    const refetchDriverRoute = vi.fn();
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        latitude: 11.001,
        longitude: 124.002,
        heading: 80,
        speed: 5,
        recordedAt: 1_000,
      }),
    );
    vi.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
      coords: {
        latitude: 11.003,
        longitude: 124.004,
        heading: 90,
        speed: 7,
      },
      timestamp: 2_000,
    } as Location.LocationObject);

    useNavigationLifecycle({
      isDriving: true,
      forceFollow,
      refetchDriverRoute,
    });

    expect(AppState.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
    expect(useActiveTripStore.getState().navSession).toEqual(
      expect.objectContaining({
        lastBackgroundedAt: null,
      }),
    );

    appStateListener?.('background');
    expect(useActiveTripStore.getState().navSession?.lastBackgroundedAt).toEqual(
      expect.any(Number),
    );

    appStateListener?.('active');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(forceFollow).toHaveBeenCalledOnce();
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(
      DRIVER_LAST_BACKGROUND_LOCATION_KEY,
    );
    expect(refetchDriverRoute).toHaveBeenCalledOnce();
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.BestForNavigation,
    });
    expect(useActiveTripStore.getState().driverLocation).toEqual({
      latitude: 11.003,
      longitude: 124.004,
    });
    expect(useAvailabilityStore.getState().lastLatitude).toBe(11.003);
    expect(useActiveTripStore.getState().navSession?.lastBackgroundedAt).toBeNull();
  });
});
