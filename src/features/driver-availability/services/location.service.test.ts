import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DRIVER_BACKGROUND_LOCATION_TASK,
  DRIVER_BACKGROUND_LOCATION_UID_KEY,
  getBackgroundLocationOptions,
  getLocationPublishPayload,
  publishDriverLocation,
  startBackgroundPublishing,
  stopBackgroundPublishing,
} from './location.service';

vi.mock('expo-location', () => ({
  Accuracy: {
    Balanced: 3,
    BestForNavigation: 6,
  },
  getForegroundPermissionsAsync: vi.fn(),
  requestForegroundPermissionsAsync: vi.fn(),
  getBackgroundPermissionsAsync: vi.fn(),
  requestBackgroundPermissionsAsync: vi.fn(),
  hasStartedLocationUpdatesAsync: vi.fn(),
  startLocationUpdatesAsync: vi.fn(),
  stopLocationUpdatesAsync: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@/services/firebase/firebase', () => ({
  firestore: {},
  doc: vi.fn(() => ({ path: 'drivers/driver-1' })),
  serverTimestamp: vi.fn(() => 'server-time'),
  updateDoc: vi.fn(),
}));

import { doc, serverTimestamp, updateDoc } from '@/services/firebase/firebase';

describe('location.service background tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
      status: 'granted',
    } as never);
    vi.mocked(Location.getBackgroundPermissionsAsync).mockResolvedValue({
      status: 'granted',
    } as never);
    vi.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(false);
  });

  it('builds SDK-compatible background location options', () => {
    expect(getBackgroundLocationOptions()).toEqual({
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 25,
      timeInterval: 10_000,
      deferredUpdatesDistance: 25,
      deferredUpdatesInterval: 10_000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Pakyaw driver location active',
        notificationBody: 'Sharing your location while you are online or on a trip.',
        notificationColor: '#208AEF',
      },
    });
  });

  it('builds valid payload from LocationObjectCoords', () => {
    const loc: Location.LocationObject = {
      coords: {
        latitude: 11.005,
        longitude: 124.605,
        altitude: null,
        accuracy: 8,
        altitudeAccuracy: null,
        heading: 90,
        speed: 12,
      },
      timestamp: Date.now(),
    };
    const payload = getLocationPublishPayload(loc);
    expect(payload.location).toEqual({
      latitude: 11.005,
      longitude: 124.605,
      accuracyMeters: 8,
    });
    expect(payload.geohash).toBeTypeOf('string');
    expect(payload.geohash.length).toBe(7);
    expect(payload.heading).toBe(90);
    expect(payload.locationUpdatedAt).toBe('server-time');
  });

  it('writes to drivers/{uid} with server timestamp', async () => {
    const loc: Location.LocationObject = {
      coords: {
        latitude: 11.005,
        longitude: 124.605,
        altitude: null,
        accuracy: 8,
        altitudeAccuracy: null,
        heading: 90,
        speed: 12,
      },
      timestamp: Date.now(),
    };
    await publishDriverLocation('driver-1', loc);
    expect(doc).toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        heading: 90,
        location: {
          latitude: 11.005,
          longitude: 124.605,
          accuracyMeters: 8,
        },
        locationUpdatedAt: 'server-time',
      }),
    );
  });

  it('starts the background location task after background permission is available', async () => {
    await startBackgroundPublishing('driver-1');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      DRIVER_BACKGROUND_LOCATION_UID_KEY,
      'driver-1',
    );
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      DRIVER_BACKGROUND_LOCATION_TASK,
      expect.objectContaining({
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 25,
      }),
    );
  });

  it('stops the background task only when started', async () => {
    vi.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true);

    await stopBackgroundPublishing();

    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(
      DRIVER_BACKGROUND_LOCATION_TASK,
    );
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      DRIVER_BACKGROUND_LOCATION_UID_KEY,
    );
  });

  it('throws LocationPermissionError when background permission is denied', async () => {
    vi.mocked(Location.getBackgroundPermissionsAsync).mockResolvedValue({
      status: 'denied',
    } as never);
    vi.mocked(Location.requestBackgroundPermissionsAsync).mockResolvedValue({
      status: 'denied',
    } as never);

    await expect(startBackgroundPublishing('driver-1')).rejects.toThrow(
      'Background location permission is required',
    );
    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });
});
