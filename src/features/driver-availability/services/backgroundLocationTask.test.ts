import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DRIVER_BACKGROUND_LOCATION_TASK,
  DRIVER_LAST_BACKGROUND_LOCATION_KEY,
  publishDriverLocation,
} from './location.service';

vi.mock('expo-task-manager', () => ({
  defineTask: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

vi.mock('@/services/firebase/firebase', () => ({
  auth: {
    currentUser: { uid: 'driver-1' },
  },
}));

vi.mock('@/stores/sessionStore', () => ({
  useSessionStore: {
    getState: vi.fn(() => ({ uid: null })),
  },
}));

vi.mock('@/lib/throttle', () => ({
  shouldEmit: vi.fn(() => false),
}));

vi.mock('./location.service', () => ({
  DRIVER_BACKGROUND_LOCATION_TASK: 'pakyaw-driver-background-location',
  DRIVER_BACKGROUND_LOCATION_UID_KEY: 'pakyaw:driver-background-location-uid',
  DRIVER_LAST_BACKGROUND_LOCATION_KEY: 'pakyaw:last-bg-location',
  publishDriverLocation: vi.fn(),
}));

describe('backgroundLocationTask', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    await import('./backgroundLocationTask');
  });

  it('writes the latest background sample to AsyncStorage on each task tick', async () => {
    expect(TaskManager.defineTask).toHaveBeenCalledWith(
      DRIVER_BACKGROUND_LOCATION_TASK,
      expect.any(Function),
    );

    const task = vi.mocked(TaskManager.defineTask).mock.calls[0][1];
    await task({
      data: {
        locations: [
          {
            coords: {
              latitude: 11.001,
              longitude: 124.002,
              heading: 87,
              speed: 6,
            },
            timestamp: 123_456,
          },
        ],
      },
      error: null,
      executionInfo: {
        eventId: 'event-1',
        taskName: DRIVER_BACKGROUND_LOCATION_TASK,
      },
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      DRIVER_LAST_BACKGROUND_LOCATION_KEY,
      JSON.stringify({
        latitude: 11.001,
        longitude: 124.002,
        heading: 87,
        speed: 6,
        recordedAt: 123_456,
      }),
    );
    expect(publishDriverLocation).not.toHaveBeenCalled();
  });
});
