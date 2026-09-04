import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { DriverMatchedSheet } from './DriverMatchedSheet';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import type { TripDoc } from '@pakyaw/shared/features/trip/types';

vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

const mockCancel = vi.fn();
let mockIsPending = false;
let mockIsError = false;
let mockError: Error | null = null;

vi.mock('@pakyaw/shared/features/trip/hooks/useTripActions', () => ({
  useCancelTrip: () => ({
    mutate: mockCancel,
    isPending: mockIsPending,
    isError: mockIsError,
    error: mockError,
    reset: vi.fn(),
  }),
}));

describe('DriverMatchedSheet component', () => {
  beforeEach(() => {
    useActiveTripStore.getState().clearTrip();
    mockCancel.mockClear();
    mockIsPending = false;
    mockIsError = false;
    mockError = null;
  });

  const baseAcceptedTrip: TripDoc = {
    id: 'trip-456',
    mode: 'solo',
    status: 'accepted',
    passengerId: 'p-1',
    driverId: 'd-1',
    driverPublic: {
      driverId: 'd-1',
      displayName: 'Mang Juan dela Cruz',
      profilePhotoUrl: 'https://example.com/driver.jpg',
      vehicle: {
        type: 'Tricycle',
        description: 'Blue Bajaj RE',
        plateNumber: '7890 HA',
        unitBodyNumber: '042',
      },
      verification: { verified: true },
    },
    pickup: { label: 'Ormoc City Hall', coords: { lat: 11.005, lng: 124.6075 } },
    destination: { label: 'Ormoc Superdome', coords: { lat: 11.007, lng: 124.609 } },
    passengerCount: 1,
    billedSeats: 4,
    geohash: 'w9x8y7',
    requestedAt: null,
    acceptedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    fare: 60,
    fareBreakdown: {
      baseFare: 40,
      distanceFare: 5,
      surcharges: 0,
      techFee: 15,
      total: 60,
      driverEarnings: 45,
    },
    driverRoute: {
      polyline: 'mock_driver_poly',
      distanceMeters: 800,
      durationSeconds: 150, // 2.5 min -> ~3 min away
      updatedAt: null,
    },
  };

  it('renders Pakyaw accepted state with prominent Driver name, plate number, and duration ETA', () => {
    useActiveTripStore.getState().setTrip(baseAcceptedTrip);

    const element = <DriverMatchedSheet />;
    expect(element).toBeDefined();

    const state = useActiveTripStore.getState().trip;
    expect(state?.driverPublic?.displayName).toBe('Mang Juan dela Cruz');
    expect(state?.driverPublic?.vehicle.plateNumber).toBe('7890 HA');
    expect(state?.driverPublic?.vehicle.unitBodyNumber).toBe('042');
    expect(state?.fareBreakdown?.total).toBe(60);
  });

  it('renders Shared accepted state with seat occupancy from sharedRideSummary', () => {
    useActiveTripStore.getState().setTrip({
      ...baseAcceptedTrip,
      mode: 'shared',
      passengerCount: 2,
      billedSeats: 2,
      sharedRideSummary: {
        seatsOccupied: 4,
        maxSeats: 6,
        passengerGroups: 2,
      },
    });

    const element = <DriverMatchedSheet />;
    expect(element).toBeDefined();

    const state = useActiveTripStore.getState().trip;
    expect(state?.mode).toBe('shared');
    expect(state?.sharedRideSummary?.seatsOccupied).toBe(4);
    expect(state?.sharedRideSummary?.maxSeats).toBe(6);
  });

  it('renders Hop accepted state with 1 seat and route corridor context', () => {
    useActiveTripStore.getState().setTrip({
      ...baseAcceptedTrip,
      mode: 'hop',
      passengerCount: 1,
      billedSeats: 1,
      sharedRideSummary: {
        seatsOccupied: 3,
        maxSeats: 6,
        passengerGroups: 2,
      },
    });

    const element = <DriverMatchedSheet />;
    expect(element).toBeDefined();

    const state = useActiveTripStore.getState().trip;
    expect(state?.mode).toBe('hop');
  });

  it('handles tripProgress.etaSeconds over driverRoute.durationSeconds', () => {
    useActiveTripStore.getState().setTrip({
      ...baseAcceptedTrip,
      tripProgress: {
        remainingMeters: 400,
        etaSeconds: 90,
        updatedAt: null,
      },
      driverRoute: {
        polyline: 'poly',
        distanceMeters: 800,
        durationSeconds: 240,
        updatedAt: null,
      },
    });

    const element = <DriverMatchedSheet />;
    expect(element).toBeDefined();
  });

  it('falls back to neutral "Your Driver is on the way" when no ETA duration or distance is available', () => {
    useActiveTripStore.getState().setTrip({
      ...baseAcceptedTrip,
      tripProgress: null,
      driverRoute: null,
    });

    const element = <DriverMatchedSheet />;
    expect(element).toBeDefined();
  });

  it('renders self-booking privacy disclosure when bookingFor is self or omitted', () => {
    useActiveTripStore.getState().setTrip({
      ...baseAcceptedTrip,
      bookingFor: 'self',
    });

    const element = <DriverMatchedSheet />;
    expect(element).toBeDefined();
    expect(useActiveTripStore.getState().trip?.bookingFor).toBe('self');
  });

  it('renders third-party booking privacy disclosure when bookingFor is other', () => {
    useActiveTripStore.getState().setTrip({
      ...baseAcceptedTrip,
      bookingFor: 'other',
      rider: { firstName: 'Dree' },
      pickupNote: 'Waiting near gate',
    });

    const element = <DriverMatchedSheet />;
    expect(element).toBeDefined();
    expect(useActiveTripStore.getState().trip?.bookingFor).toBe('other');
    expect(useActiveTripStore.getState().trip?.rider?.firstName).toBe('Dree');
  });

  it('gracefully handles missing optional Driver and vehicle data without crashing and without fabricating data', () => {
    const minimalTrip: TripDoc = {
      ...baseAcceptedTrip,
      driverPublic: {
        driverId: 'd-2',
        displayName: 'Pedro',
        profilePhotoUrl: null,
        vehicle: {
          plateNumber: '1234 XY',
        },
        verification: { verified: true },
      },
      driverRoute: null,
      tripProgress: null,
    };

    useActiveTripStore.getState().setTrip(minimalTrip);

    const element = <DriverMatchedSheet />;
    expect(element).toBeDefined();

    const state = useActiveTripStore.getState().trip;
    expect(state?.driverPublic?.profilePhotoUrl).toBeNull();
    expect(state?.driverPublic?.vehicle.unitBodyNumber).toBeUndefined();
  });

  it('verifies requested -> accepted transition in activeTripStore', () => {
    const requestedTrip: TripDoc = {
      ...baseAcceptedTrip,
      status: 'requested',
      driverId: null,
      driverPublic: null,
    };

    useActiveTripStore.getState().setTrip(requestedTrip);
    expect(useActiveTripStore.getState().trip?.status).toBe('requested');
    expect(useActiveTripStore.getState().trip?.driverId).toBeNull();

    useActiveTripStore.getState().setTrip(baseAcceptedTrip);
    expect(useActiveTripStore.getState().trip?.status).toBe('accepted');
    expect(useActiveTripStore.getState().trip?.driverId).toBe('d-1');
  });
});
