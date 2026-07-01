import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPersistedActiveTripState,
  migratePersistedActiveTripState,
  useActiveTripStore,
  type ActiveTripState,
} from './activeTripStore';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe('activeTripStore', () => {
  beforeEach(() => {
    useActiveTripStore.setState({
      tripId: null,
      trip: null,
      driverLocation: null,
      navHeading: null,
      gpsHeading: null,
      gpsSpeed: null,
      navStepIndex: 0,
      navActiveStatus: null,
      navSession: null,
      cameraFollowing: true,
    });
  });

  it('persists the active trip id, current navigation step, arm state, session, and camera follow state', () => {
    const navSession = {
      startedAt: 100,
      lastForegroundAt: 200,
      lastBackgroundedAt: 300,
    };
    const state = {
      ...useActiveTripStore.getState(),
      tripId: 'trip-1',
      trip: { id: 'trip-1' },
      driverLocation: { latitude: 11, longitude: 124 },
      navHeading: 90,
      gpsHeading: 88,
      gpsSpeed: 4,
      navStepIndex: 3,
      navActiveStatus: 'in_progress',
      navSession,
      cameraFollowing: false,
    } as ActiveTripState;

    expect(getPersistedActiveTripState(state)).toEqual({
      tripId: 'trip-1',
      navStepIndex: 3,
      navActiveStatus: 'in_progress',
      navSession,
      cameraFollowing: false,
    });
  });

  it('clears persisted navigation state when the active trip is cleared', () => {
    const store = useActiveTripStore.getState();

    store.setTripId('trip-1');
    store.setNavStepIndex(2);
    store.clearTrip();

    const state = useActiveTripStore.getState();
    expect(state.tripId).toBeNull();
    expect(state.navStepIndex).toBe(0);
    expect(state.navActiveStatus).toBeNull();
    expect(state.navSession).toBeNull();
    expect(state.cameraFollowing).toBe(true);
    expect(state.driverLocation).toBeNull();
  });

  it('migrates v2 persisted navigation state to v3 defaults', () => {
    expect(
      migratePersistedActiveTripState(
        {
          tripId: 'trip-1',
          navStepIndex: 4,
          navActiveStatus: 'in_progress',
        },
        2,
      ),
    ).toEqual({
      tripId: 'trip-1',
      navStepIndex: 4,
      navActiveStatus: 'in_progress',
      navSession: null,
      cameraFollowing: true,
    });
  });

  it('clears every nav-only slice when a trip transitions to a terminal status', () => {
    useActiveTripStore.setState({
      tripId: 'trip-1',
      trip: null,
      driverLocation: { latitude: 11, longitude: 124 },
      navHeading: 123,
      gpsHeading: 122,
      gpsSpeed: 8,
      navStepIndex: 5,
      navActiveStatus: 'in_progress',
      navSession: {
        startedAt: 1,
        lastForegroundAt: 2,
        lastBackgroundedAt: null,
      },
      cameraFollowing: false,
    } as Partial<ActiveTripState> as ActiveTripState);

    useActiveTripStore.getState().setTrip({
      id: 'trip-1',
      status: 'completed',
    } as never);

    const state = useActiveTripStore.getState();
    expect(state.trip?.status).toBe('completed');
    expect(state.navHeading).toBeNull();
    expect(state.gpsHeading).toBeNull();
    expect(state.gpsSpeed).toBeNull();
    expect(state.navStepIndex).toBe(0);
    expect(state.navActiveStatus).toBeNull();
    expect(state.navSession).toBeNull();
    expect(state.cameraFollowing).toBe(true);
    // Driver location is kept so the terminal camera has a target to center on.
    expect(state.driverLocation).toEqual({ latitude: 11, longitude: 124 });
  });

  it('does not wipe nav state on a non-terminal status update', () => {
    useActiveTripStore.setState({
      tripId: 'trip-1',
      trip: null,
      driverLocation: { latitude: 11, longitude: 124 },
      navHeading: 90,
      gpsHeading: 90,
      gpsSpeed: 5,
      navStepIndex: 3,
      navActiveStatus: 'driver_arriving',
      navSession: {
        startedAt: 1,
        lastForegroundAt: 2,
        lastBackgroundedAt: null,
      },
      cameraFollowing: false,
    } as Partial<ActiveTripState> as ActiveTripState);

    useActiveTripStore.getState().setTrip({
      id: 'trip-1',
      status: 'in_progress',
    } as never);

    const state = useActiveTripStore.getState();
    expect(state.navHeading).toBe(90);
    expect(state.navStepIndex).toBe(3);
    expect(state.navActiveStatus).toBe('driver_arriving');
    expect(state.navSession).not.toBeNull();
    expect(state.cameraFollowing).toBe(false);
  });
});
