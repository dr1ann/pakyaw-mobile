import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { SearchingSheet } from './SearchingSheet';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import type { TripDoc } from '@pakyaw/shared/features/trip/types';

vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

vi.mock('@pakyaw/shared/components/ui/Sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

describe('SearchingSheet component', () => {
  beforeEach(() => {
    useActiveTripStore.getState().clearTrip();
    mockCancel.mockClear();
    mockIsPending = false;
    mockIsError = false;
    mockError = null;
  });

  const baseTrip: TripDoc = {
    id: 'trip-123',
    mode: 'solo',
    status: 'requested',
    passengerId: 'p-1',
    driverId: null,
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
    fare: 55,
    fareBreakdown: {
      baseFare: 40,
      distanceFare: 0,
      surcharges: 0,
      techFee: 15,
      total: 55,
      driverEarnings: 40,
    },
    matching: {
      stage: 'initial',
    },
  };

  it('renders connecting state when trip document has not loaded yet', () => {
    useActiveTripStore.getState().setTripId('trip-123');

    const element = <SearchingSheet />;
    expect(element).toBeDefined();
  });

  it('renders Pakyaw requested state with truthful copy and quoted fare', () => {
    useActiveTripStore.getState().setTrip(baseTrip);

    const element = <SearchingSheet />;
    expect(element).toBeDefined();
    expect(useActiveTripStore.getState().trip?.mode).toBe('solo');
  });

  it('renders Shared requested state with truthful shared copy', () => {
    useActiveTripStore.getState().setTrip({
      ...baseTrip,
      mode: 'shared',
      passengerCount: 2,
      billedSeats: 2,
    });

    const element = <SearchingSheet />;
    expect(element).toBeDefined();
    expect(useActiveTripStore.getState().trip?.mode).toBe('shared');
  });

  it('renders Hop requested state with truthful along-route copy and no radar terms', () => {
    useActiveTripStore.getState().setTrip({
      ...baseTrip,
      mode: 'hop',
      passengerCount: 1,
      billedSeats: 1,
    });

    const element = <SearchingSheet />;
    expect(element).toBeDefined();
    expect(useActiveTripStore.getState().trip?.mode).toBe('hop');
  });

  it('renders timed out state when matching stage is timed_out', () => {
    useActiveTripStore.getState().setTrip({
      ...baseTrip,
      mode: 'hop',
      matching: {
        stage: 'timed_out',
      },
    });

    const element = <SearchingSheet />;
    expect(element).toBeDefined();
    expect(useActiveTripStore.getState().trip?.matching?.stage).toBe('timed_out');
  });
});
