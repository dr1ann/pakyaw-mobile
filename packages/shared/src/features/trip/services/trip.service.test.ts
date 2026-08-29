import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callable: vi.fn(),
  onSnapshot: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => args),
  onSnapshot: mocks.onSnapshot,
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
}));
vi.mock('firebase/functions', () => ({ httpsCallable: mocks.callable }));
vi.mock('@/services/firebase/firebase', () => ({ firestore: {}, functions: {} }));

import { CancelNotAllowedError, IllegalTransitionError } from '../errors';
import { cancel, subscribe, transition } from './trip.service';

describe('Day 3 callable trip actions', () => {
  beforeEach(() => {
    mocks.callable.mockReset();
    mocks.onSnapshot.mockReset();
  });

  it('maps canonical realtime Trip fields without operational defaults', () => {
    const onSnap = vi.fn();
    mocks.onSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        id: 'trip-canonical',
        exists: () => true,
        data: () => ({
          passengerId: 'passenger-1',
          driverId: null,
          mode: 'solo',
          status: 'requested',
          pickup: { latitude: 11.005, longitude: 124.6075, label: 'Pickup' },
          destination: { latitude: 11.012, longitude: 124.615, label: 'Destination' },
          route: { distanceMeters: 3_400, durationSeconds: 480, polyline: 'encoded-route' },
          passengerCount: 3,
          billedSeats: 3,
          fare: 55,
        }),
      });
      return mocks.unsubscribe;
    });

    subscribe('trip-canonical', onSnap, vi.fn());

    expect(onSnap).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'solo',
      status: 'requested',
      passengerCount: 3,
      billedSeats: 3,
      fare: 55,
      route: expect.objectContaining({
        distanceMeters: 3_400,
        durationSeconds: 480,
        polyline: 'encoded-route',
      }),
    }));
  });

  it('keeps legacy Trip defaults isolated to the compatibility reader', () => {
    const onSnap = vi.fn();
    mocks.onSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        id: 'trip-legacy',
        exists: () => true,
        data: () => ({
          passengerId: 'passenger-1',
          pickup: { latitude: 11.005, longitude: 124.6075 },
          destination: { latitude: 11.012, longitude: 124.615 },
        }),
      });
      return mocks.unsubscribe;
    });

    subscribe('trip-legacy', onSnap, vi.fn());

    expect(onSnap).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'solo',
      status: 'requested',
      passengerCount: 1,
      billedSeats: 1,
    }));
  });

  it('sends driver transitions through the server-authoritative callable', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { result: 'ok' } });
    mocks.callable.mockReturnValue(invoke);

    await expect(transition('trip-1', 'driver-1', 'driver_arriving')).resolves.toBeUndefined();
    expect(mocks.callable).toHaveBeenCalledWith({}, 'transitionTrip');
    expect(invoke).toHaveBeenCalledWith({
      tripId: 'trip-1',
      actorId: 'driver-1',
      transition: 'driver_arriving',
    });
  });

  it('does not allow a client to manufacture requested or accepted transitions', async () => {
    await expect(transition('trip-1', 'driver-1', 'requested')).rejects.toBeInstanceOf(IllegalTransitionError);
    await expect(transition('trip-1', 'driver-1', 'accepted')).rejects.toBeInstanceOf(IllegalTransitionError);
  });

  it('maps rejected lifecycle and cancellation results to safe domain errors', async () => {
    mocks.callable.mockReturnValue(vi.fn().mockResolvedValue({ data: { result: 'invalid_transition' } }));
    await expect(transition('trip-1', 'driver-1', 'driver_arriving')).rejects.toBeInstanceOf(IllegalTransitionError);

    mocks.callable.mockReturnValue(vi.fn().mockResolvedValue({ data: { result: 'cannot_cancel' } }));
    await expect(cancel('trip-1', 'passenger-1', 'passenger_changed_mind')).rejects.toBeInstanceOf(CancelNotAllowedError);
  });

  it('sends only canonical cancellation reasons to the callable', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { result: 'ok' } });
    mocks.callable.mockReturnValue(invoke);

    await cancel('trip-1', 'driver-1', 'vehicle_issue');
    expect(mocks.callable).toHaveBeenCalledWith({}, 'cancelTrip');
    expect(invoke).toHaveBeenCalledWith({
      tripId: 'trip-1',
      actorId: 'driver-1',
      reason: 'vehicle_issue',
    });
  });
});
