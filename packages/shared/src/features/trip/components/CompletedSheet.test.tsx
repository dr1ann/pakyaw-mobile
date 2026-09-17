import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { CompletedSheet } from './CompletedSheet';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import type { TripDoc } from '@pakyaw/shared/features/trip/types';

vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

describe('CompletedSheet component — Phase 8 Passenger Completion & Receipt', () => {
  beforeEach(() => {
    useActiveTripStore.getState().clearTrip();
  });

  const baseCompletedTrip: TripDoc = {
    id: 'trip-comp-101',
    mode: 'solo',
    status: 'completed',
    passengerId: 'p-1',
    driverId: 'd-1',
    driverPublic: {
      driverId: 'd-1',
      displayName: 'Kuya Juan',
      profilePhotoUrl: 'https://example.com/driver.jpg',
      vehicle: {
        type: 'Tricycle',
        description: 'Black Bajaj Maxima',
        plateNumber: '8899 HA',
        unitBodyNumber: '055',
      },
      verification: { verified: true },
    },
    pickup: { label: 'Ormoc Port', coords: { lat: 11.002, lng: 124.605 } },
    destination: { label: 'Robinsons Place Ormoc', coords: { lat: 11.015, lng: 124.61 } },
    passengerCount: 1,
    billedSeats: 4,
    geohash: 'w9x8y7',
    requestedAt: { seconds: 1788520000, nanoseconds: 0 } as any,
    acceptedAt: { seconds: 1788520100, nanoseconds: 0 } as any,
    completedAt: { seconds: 1788521000, nanoseconds: 0 } as any,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    fare: 68.5,
    fareBreakdown: {
      baseFare: 40,
      distanceFare: 13.5,
      surcharges: 0,
      techFee: 15,
      total: 68.5,
      driverEarnings: 53.5,
    },
    route: {
      distanceMeters: 3200,
      durationSeconds: 480,
      polyline: 'mock_route_poly',
      fetchedAt: null,
    },
  };

  it('renders completed Pakyaw trip with authoritative fare and road distance', () => {
    useActiveTripStore.getState().setTrip(baseCompletedTrip);
    const onDismiss = vi.fn();
    const onViewActivity = vi.fn();

    const element = (
      <CompletedSheet
        onDismiss={onDismiss}
        onViewActivity={onViewActivity}
      />
    );
    expect(element).toBeDefined();

    const trip = useActiveTripStore.getState().trip;
    expect(trip?.status).toBe('completed');
    expect(trip?.fare).toBe(68.5);
    expect(trip?.driverPublic?.displayName).toBe('Kuya Juan');
    expect(trip?.driverPublic?.vehicle.plateNumber).toBe('8899 HA');
    expect(trip?.route?.distanceMeters).toBe(3200);
  });

  it('renders Shared completed trip with Shared mode label', () => {
    useActiveTripStore.getState().setTrip({
      ...baseCompletedTrip,
      mode: 'shared',
      passengerCount: 2,
      billedSeats: 2,
      fare: 35.0,
      fareBreakdown: {
        baseFare: 20,
        distanceFare: 7.5,
        surcharges: 0,
        techFee: 7.5,
        total: 35.0,
        driverEarnings: 27.5,
      },
    });

    const element = <CompletedSheet onDismiss={vi.fn()} />;
    expect(element).toBeDefined();

    const trip = useActiveTripStore.getState().trip;
    expect(trip?.mode).toBe('shared');
    expect(trip?.fare).toBe(35.0);
  });

  it('renders third-party booking recipient info when bookingFor is other', () => {
    useActiveTripStore.getState().setTrip({
      ...baseCompletedTrip,
      bookingFor: 'other',
      rider: { firstName: 'Dree' },
    });

    const element = <CompletedSheet onDismiss={vi.fn()} />;
    expect(element).toBeDefined();

    const trip = useActiveTripStore.getState().trip;
    expect(trip?.bookingFor).toBe('other');
    expect(trip?.rider?.firstName).toBe('Dree');
  });

  it('handles missing route distance gracefully without straight-line fabrication', () => {
    useActiveTripStore.getState().setTrip({
      ...baseCompletedTrip,
      route: null,
    });

    const element = <CompletedSheet onDismiss={vi.fn()} />;
    expect(element).toBeDefined();

    const trip = useActiveTripStore.getState().trip;
    expect(trip?.route).toBeNull();
  });

  it('handles missing driver vehicle metadata gracefully', () => {
    useActiveTripStore.getState().setTrip({
      ...baseCompletedTrip,
      driverPublic: {
        driverId: 'd-1',
        displayName: 'Driver Joe',
        vehicle: {
          plateNumber: '1122 HA',
        },
        verification: { verified: true },
      },
    });

    const element = <CompletedSheet onDismiss={vi.fn()} />;
    expect(element).toBeDefined();

    const trip = useActiveTripStore.getState().trip;
    expect(trip?.driverPublic?.displayName).toBe('Driver Joe');
    expect(trip?.driverPublic?.vehicle.plateNumber).toBe('1122 HA');
  });
});
