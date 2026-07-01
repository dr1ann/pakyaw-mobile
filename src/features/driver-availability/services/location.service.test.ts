import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
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

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ path: 'drivers/driver-1' })),
  serverTimestamp: vi.fn(() => 'server-time'),
  updateDoc: vi.fn(),
}));

vi.mock('@/services/firebase/firebase', () => ({
  firestore: {},
}));

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

  it('starts the background location task after background permission is available', async () => {
    await startBackgroundPublishing('driver-1');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      DRIVER_BACKGROUND_LOCATION_UID_KEY,
      'driver-1',
    );
    expect(Location.hasStartedLocationUpdatesAsync).toHaveBeenCalledWith(
      DRIVER_BACKGROUND_LOCATION_TASK,
    );
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      DRIVER_BACKGROUND_LOCATION_TASK,
      getBackgroundLocationOptions(),
    );
  });

  it('does not start the background task twice', async () => {
    vi.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true);

    await startBackgroundPublishing('driver-1');

    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
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

  it('publishes the same driver location payload for foreground and background updates', async () => {
    const locationObject = {
      coords: {
        latitude: 11.001,
        longitude: 124.002,
        heading: 87,
      },
    } as Location.LocationObject;

    expect(getLocationPublishPayload(locationObject)).toEqual({
      location: { latitude: 11.001, longitude: 124.002 },
      geohash: expect.any(String),
      heading: 87,
      locationUpdatedAt: 'server-time',
    });

    await publishDriverLocation('driver-1', locationObject);

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'drivers', 'driver-1');
    expect(serverTimestamp).toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalledWith(
      { path: 'drivers/driver-1' },
      expect.objectContaining({
        location: { latitude: 11.001, longitude: 124.002 },
        heading: 87,
        locationUpdatedAt: 'server-time',
      }),
    );
  });
});
