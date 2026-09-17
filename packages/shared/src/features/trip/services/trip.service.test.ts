import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callable: vi.fn(),
  onSnapshot: vi.fn(),
  unsubscribe: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock('@/services/firebase/firebase', () => ({
  firestore: {},
  functions: {},
  doc: vi.fn((...args: unknown[]) => args),
  getDoc: mocks.getDoc,
  onSnapshot: mocks.onSnapshot,
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
  httpsCallable: mocks.callable,
}));

import { CancelNotAllowedError, IllegalTransitionError } from '../errors';
import { cancel, getTrip, reconcileActiveTrip, subscribe, transition } from './trip.service';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';

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
          fare: {
            baseFare: 50,
            succeedingKmCharge: 0,
            distanceFare: 0,
            techFee: 5,
            total: 55,
            driverEarnings: 50,
            perSeat: { baseFare: 50, succeedingKmCharge: 0, distanceFare: 0, surchargeTotal: 0, transportFare: 50 },
            billedSeats: 3,
            transportFare: 50,
            surcharges: { items: [], total: 0 },
            serviceFee: { configuredAmount: 5, passengerPaid: 5, driverContribution: 0, driverBonus: 0, platformReceivable: 5 },
            feeTreatment: { scheme: 'full_pass_on' },
            passengerTotal: 55,
            platformReceivable: 5,
            configSchemaVersion: 2,
          },
          driverPublic: {
            driverId: 'driver-1',
            displayName: 'Ada Driver',
            profilePhotoUrl: null,
            vehicle: { type: 'tricycle', description: 'Blue tricycle', plateNumber: 'ABC-1234', unitBodyNumber: 'UNIT-001' },
            verification: { verified: true },
          },
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
      fareBreakdown: expect.objectContaining({ total: 55, driverEarnings: 50 }),
      route: expect.objectContaining({
        distanceMeters: 3_400,
        durationSeconds: 480,
        polyline: 'encoded-route',
      }),
      driverPublic: expect.objectContaining({
        displayName: 'Ada Driver',
        vehicle: expect.objectContaining({ plateNumber: 'ABC-1234' }),
      }),
    }));
    expect(onSnap.mock.calls[0][0].fareBreakdown.surcharges).toEqual({ items: [], total: 0 });
  });

  it('maps canonical third-party booking fields (bookingFor, rider, pickupNote)', () => {
    const onSnap = vi.fn();
    mocks.onSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        id: 'trip-third-party',
        exists: () => true,
        data: () => ({
          passengerId: 'booker-uid-123',
          driverId: 'driver-uid-456',
          mode: 'solo',
          status: 'accepted',
          bookingFor: 'other',
          rider: { firstName: 'Dree' },
          pickupNote: 'Ghh',
          pickup: { latitude: 11.005, longitude: 124.6075, label: 'Ormoc City Hall' },
          destination: { latitude: 11.012, longitude: 124.615, label: 'Ormoc Superdome' },
          route: { distanceMeters: 2_100, durationSeconds: 300, polyline: 'test-poly' },
          passengerCount: 1,
          billedSeats: 1,
          fare: {
            baseFare: 40,
            distanceFare: 10,
            surcharges: 0,
            techFee: 5,
            total: 55,
            driverEarnings: 50,
          },
        }),
      });
      return mocks.unsubscribe;
    });

    subscribe('trip-third-party', onSnap, vi.fn());

    expect(onSnap).toHaveBeenCalledWith(expect.objectContaining({
      id: 'trip-third-party',
      bookingFor: 'other',
      rider: { firstName: 'Dree' },
      pickupNote: 'Ghh',
      status: 'accepted',
      passengerId: 'booker-uid-123',
      driverId: 'driver-uid-456',
    }));
  });

  it('drops malformed or legacy Driver identity data instead of presenting it', () => {
    const onSnap = vi.fn();
    mocks.onSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        id: 'trip-invalid-driver-public',
        exists: () => true,
        data: () => ({
          passengerId: 'passenger-1',
          driverPublic: { name: 'Legacy driver', plateNumber: 'FAKE-1' },
          pickup: { latitude: 11.005, longitude: 124.6075 },
          destination: { latitude: 11.012, longitude: 124.615 },
        }),
      });
      return mocks.unsubscribe;
    });

    subscribe('trip-invalid-driver-public', onSnap, vi.fn());

    expect(onSnap).toHaveBeenCalledWith(expect.objectContaining({ driverPublic: null }));
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
    expect(mocks.callable).toHaveBeenCalledWith(expect.anything(), 'transitionTrip');
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
    expect(mocks.callable).toHaveBeenCalledWith(expect.anything(), 'cancelTrip');
    expect(invoke).toHaveBeenCalledWith({
      tripId: 'trip-1',
      actorId: 'driver-1',
      reason: 'vehicle_issue',
    });
  });

  describe('Authoritative trip reconciliation (reconcileActiveTrip)', () => {
    beforeEach(() => {
      useActiveTripStore.getState().clearTrip();
      mocks.getDoc.mockReset();
    });

    it('canonical terminal read → retains terminal trip presentation', async () => {
      mocks.getDoc.mockResolvedValueOnce({
        id: 'trip-term-1',
        exists: () => true,
        data: () => ({
          passengerId: 'p-1',
          driverId: 'driver-1',
          mode: 'solo',
          status: 'completed',
          pickup: { latitude: 11.005, longitude: 124.6075 },
          destination: { latitude: 11.012, longitude: 124.615 },
        }),
      });

      const res = await reconcileActiveTrip('trip-term-1', 'driver-1');

      expect(res.outcome).toBe('retained_terminal');
      expect(useActiveTripStore.getState().trip?.status).toBe('completed');
    });

    it('canonical non-terminal inconsistency → reconciles safely by clearing local trip', async () => {
      mocks.getDoc.mockResolvedValueOnce({
        id: 'trip-inconsistent',
        exists: () => true,
        data: () => ({
          passengerId: 'p-1',
          driverId: 'driver-1',
          mode: 'solo',
          status: 'driver_arrived',
          pickup: { latitude: 11.005, longitude: 124.6075 },
          destination: { latitude: 11.012, longitude: 124.615 },
        }),
      });

      const res = await reconcileActiveTrip('trip-inconsistent', 'driver-1');

      expect(res.outcome).toBe('cleared_inconsistency');
      expect(useActiveTripStore.getState().trip).toBeNull();
    });

    it('canonical trip missing → clears local trip', async () => {
      mocks.getDoc.mockResolvedValueOnce({
        id: 'trip-deleted',
        exists: () => false,
      });

      const res = await reconcileActiveTrip('trip-deleted', 'driver-1');

      expect(res.outcome).toBe('cleared_missing');
      expect(useActiveTripStore.getState().trip).toBeNull();
    });

    it('driverId mismatch → clears local trip', async () => {
      mocks.getDoc.mockResolvedValueOnce({
        id: 'trip-other-driver',
        exists: () => true,
        data: () => ({
          passengerId: 'p-1',
          driverId: 'other-driver-uid',
          mode: 'solo',
          status: 'in_progress',
          pickup: { latitude: 11.005, longitude: 124.6075 },
          destination: { latitude: 11.012, longitude: 124.615 },
        }),
      });

      const res = await reconcileActiveTrip('trip-other-driver', 'driver-1');

      expect(res.outcome).toBe('cleared_driver_mismatch');
      expect(useActiveTripStore.getState().trip).toBeNull();
    });

    it('network reconciliation failure → does not prematurely clear presentation', async () => {
      useActiveTripStore.getState().setTripId('trip-network-err');
      useActiveTripStore.getState().setTrip({
        id: 'trip-network-err',
        mode: 'solo',
        status: 'driver_arriving',
        passengerId: 'p-1',
        driverId: 'driver-1',
        pickup: { label: 'Pickup', coords: { lat: 11, lng: 124 } },
        destination: { label: 'Dropoff', coords: { lat: 11.1, lng: 124.1 } },
        passengerCount: 1,
        billedSeats: 1,
      } as any);

      mocks.getDoc.mockRejectedValueOnce(new Error('Network offline'));

      const res = await reconcileActiveTrip('trip-network-err', 'driver-1');

      expect(res.outcome).toBe('retained_network_error');
      // Trip presentation is preserved rather than discarded on network error
      expect(useActiveTripStore.getState().trip).not.toBeNull();
      expect(useActiveTripStore.getState().trip?.id).toBe('trip-network-err');
    });
  });
});
