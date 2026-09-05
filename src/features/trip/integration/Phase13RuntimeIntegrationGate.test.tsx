import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { PersistentDriverTripDashboard } from '../components/PersistentDriverTripDashboard';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { mapCanonicalSharedRide } from '@/features/shared-ride/hooks/useSharedRideSession';
import type { TripDoc, SharedRideDoc } from '@pakyaw/shared/features/trip/types';

let typedCancelReason = '';

// Mock React hooks for pure functional tree execution
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: (initial: any) => [initial === '' ? typedCancelReason : typeof initial === 'function' ? initial() : initial, vi.fn()],
    useCallback: (fn: any) => fn,
    useMemo: (fn: any) => fn(),
    useRef: (initial: any) => ({ current: initial }),
    useEffect: vi.fn(),
  };
});

// Mock usePassengerLiveLocation
vi.mock('@/features/trip/hooks/usePassengerLiveLocation', () => ({
  usePassengerLiveLocation: () => ({
    passengerLocation: null,
    formattedDistanceToPickup: null,
    isBookingForOther: false,
    isStale: false,
    timeAgoText: null,
  }),
}));

// Mock Firebase services
vi.mock('@/services/firebase/firebase', () => ({
  firestore: {},
  doc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
}));

// Mock SOS button
vi.mock('@/features/safety/components/SosButton', () => ({
  SosButton: () => null,
}));

// Mock SymbolIcon
vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

// Mock Button
vi.mock('@pakyaw/shared/components/ui/Button', () => ({
  Button: (props: any) => React.createElement('Button', props),
}));

// Mock action hooks
const mockTransition = vi.fn();
const mockCancelTrip = vi.fn();

vi.mock('@pakyaw/shared/features/trip/hooks/useTripActions', () => ({
  useTripTransition: () => ({
    mutate: mockTransition,
    isPending: false,
  }),
  useCancelTrip: () => ({
    mutate: mockCancelTrip,
    isPending: false,
  }),
}));

function findElementByTestId(tree: any, testId: string): any {
  let match: any = null;
  function walk(node: any) {
    if (!node || typeof node !== 'object') return;
    if (node.props?.testID === testId) {
      match = node;
      return;
    }
    if (Array.isArray(node.props?.children)) {
      node.props.children.forEach(walk);
    } else if (node.props?.children) {
      walk(node.props.children);
    }
  }
  walk(tree);
  return match;
}

const baseSoloTrip: TripDoc = {
  id: 'solo-trip-1',
  mode: 'solo',
  status: 'accepted',
  passengerId: 'p-solo',
  driverId: 'driver-1',
  driverPublic: {
    driverId: 'driver-1',
    displayName: 'Juan Driver',
    vehicle: { type: 'tricycle', plateNumber: 'TR-101', description: 'Blue Tricycle' },
    verification: { verified: true },
  },
  pickup: { label: 'Ormoc City Hall', coords: { lat: 11.005, lng: 124.6075 } },
  destination: { label: 'Robinsons Place Ormoc', coords: { lat: 11.018, lng: 124.618 } },
  passengerCount: 1,
  billedSeats: 1,
  geohash: 'w9x8y7',
  requestedAt: null,
  acceptedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
  fare: 50,
  fareBreakdown: { baseFare: 40, distanceFare: 10, surcharges: 0, techFee: 0, total: 50, driverEarnings: 50 },
  route: { distanceMeters: 2000, durationSeconds: 300, polyline: 'poly1', fetchedAt: null },
  bookingFor: 'self',
  rider: { firstName: 'Juan' },
  pickupNote: null,
};

describe('Phase 13 Runtime Integration Gate — 12 Required E2E Scenarios', () => {
  beforeEach(() => {
    typedCancelReason = '';
    vi.clearAllMocks();
    useActiveTripStore.getState().clearTrip();
  });

  // 1. Solo regression
  it('Scenario 1: Solo regression — full lifecycle accepted -> driver_arriving -> driver_arrived -> in_progress -> completed -> dismiss', () => {
    // accepted
    let tree = PersistentDriverTripDashboard({ trip: baseSoloTrip });
    let json = JSON.stringify(tree);
    expect(json).toContain('TRIP ACCEPTED');
    expect(json).toContain('Head to Pickup');

    let primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
    primaryBtn.props.onPress();
    expect(mockTransition).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: 'solo-trip-1', status: 'driver_arriving' }),
      expect.any(Object)
    );

    // driver_arriving
    const arrivingTrip = { ...baseSoloTrip, status: 'driver_arriving' as const };
    tree = PersistentDriverTripDashboard({ trip: arrivingTrip });
    json = JSON.stringify(tree);
    expect(json).toContain('HEADING TO PICKUP');
    expect(json).toContain('Arrived at Pickup');

    // driver_arrived
    const arrivedTrip = { ...baseSoloTrip, status: 'driver_arrived' as const };
    tree = PersistentDriverTripDashboard({ trip: arrivedTrip });
    json = JSON.stringify(tree);
    expect(json).toContain('ARRIVED AT PICKUP');
    expect(json).toContain('Start Trip');

    // in_progress
    const inProgressTrip = { ...baseSoloTrip, status: 'in_progress' as const };
    tree = PersistentDriverTripDashboard({ trip: inProgressTrip });
    json = JSON.stringify(tree);
    expect(json).toContain('TRIP IN PROGRESS');
    expect(json).toContain('End Trip');

    // completed
    const completedTrip = { ...baseSoloTrip, status: 'completed' as const };
    const mockDismiss = vi.fn();
    tree = PersistentDriverTripDashboard({ trip: completedTrip, onDismissTerminal: mockDismiss });
    json = JSON.stringify(tree);
    expect(json).toContain('TRIP COMPLETED');
    expect(json).toContain('Done • Back to Map');

    primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
    primaryBtn.props.onPress();
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  // 2. Shared first member
  it('Scenario 2: Shared first member — restores workspace from activeSharedRideId and renders backend current stop without users lookup', () => {
    const tripMaria: TripDoc = {
      ...baseSoloTrip,
      id: 'trip-maria',
      mode: 'shared',
      status: 'accepted',
      passengerCount: 2,
      billedSeats: 2,
      rider: { firstName: 'Maria' },
      pickup: { label: 'Robinsons Place Ormoc', coords: { lat: 11.018, lng: 124.618 } },
      destination: { label: 'Ormoc Port', coords: { lat: 11.002, lng: 124.605 } },
    };

    const sharedRide: SharedRideDoc = {
      id: 'shared-001',
      driverId: 'driver-1',
      status: 'active',
      maxSeats: 4,
      seatsBooked: 2,
      seatsReserved: 2,
      routePolyline: '',
      routeOrigin: { lat: 11.018, lng: 124.618 },
      routeDestination: { lat: 11.002, lng: 124.605 },
      routeGeohash: '',
      routeHeadingDeg: 0,
      corridorThresholdMeters: 0,
      tripIds: ['trip-maria'],
      members: [
        {
          tripId: 'trip-maria',
          passengerId: 'p-maria',
          seats: 2,
          pickup: { latitude: 11.018, longitude: 124.618, label: 'Robinsons Place Ormoc' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
          mode: 'shared',
          status: 'waiting_pickup',
        },
      ],
      operational: {
        stopOrder: ['trip-maria:pickup', 'trip-maria:dropoff'],
        currentStopId: 'trip-maria:pickup',
        nextStopId: 'trip-maria:dropoff',
        stops: [
          {
            id: 'trip-maria:pickup',
            tripId: 'trip-maria',
            kind: 'pickup',
            place: { latitude: 11.018, longitude: 124.618, label: 'Robinsons Place Ormoc' },
            status: 'pending',
          },
          {
            id: 'trip-maria:dropoff',
            tripId: 'trip-maria',
            kind: 'dropoff',
            place: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
            status: 'pending',
          },
        ],
      },
      passengers: [],
      createdAt: { toMillis: () => 1725500000000 } as any,
      completedAt: null,
    };

    const tree = PersistentDriverTripDashboard({
      trip: null,
      sharedRide,
      memberTrips: { 'trip-maria': tripMaria },
      currentStop: sharedRide.operational?.stops[0] ?? null,
      nextStop: sharedRide.operational?.stops[1] ?? null,
      currentTrip: tripMaria,
      occupancy: { seatsReserved: 2, maxSeats: 4, onboardCount: 0, waitingCount: 2 },
    });
    const json = JSON.stringify(tree);

    expect(json).toContain('CURRENT STOP • PICKUP');
    expect(json).toContain('Pick up Maria');
    expect(json).toContain('Robinsons Place Ormoc');
    expect(json).toContain('2 seats');
    expect(json).toContain('Shared');
    expect(json).toContain('2 / 4');
  });

  // 3. Second Shared member
  it('Scenario 3: Second Shared member — joins active session, updates reserved seats and member list without resetting current stop', () => {
    const tripMaria: TripDoc = { ...baseSoloTrip, id: 'trip-maria', mode: 'shared', rider: { firstName: 'Maria' } };
    const tripAna: TripDoc = { ...baseSoloTrip, id: 'trip-ana', mode: 'shared', rider: { firstName: 'Ana' } };

    const sharedRide: SharedRideDoc = {
      id: 'shared-001',
      driverId: 'driver-1',
      status: 'active',
      maxSeats: 4,
      seatsBooked: 3,
      seatsReserved: 3,
      routePolyline: '',
      routeOrigin: { lat: 11.018, lng: 124.618 },
      routeDestination: { lat: 11.002, lng: 124.605 },
      routeGeohash: '',
      routeHeadingDeg: 0,
      corridorThresholdMeters: 0,
      tripIds: ['trip-maria', 'trip-ana'],
      members: [
        {
          tripId: 'trip-maria',
          passengerId: 'p-maria',
          seats: 2,
          pickup: { latitude: 11.018, longitude: 124.618, label: 'Robinsons Place Ormoc' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
          mode: 'shared',
          status: 'waiting_pickup',
        },
        {
          tripId: 'trip-ana',
          passengerId: 'p-ana',
          seats: 1,
          pickup: { latitude: 11.005, longitude: 124.6075, label: 'Ormoc City Hall' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
          mode: 'shared',
          status: 'reserved',
        },
      ],
      operational: {
        stopOrder: ['trip-maria:pickup', 'trip-ana:pickup', 'trip-maria:dropoff', 'trip-ana:dropoff'],
        currentStopId: 'trip-maria:pickup', // Still Maria!
        nextStopId: 'trip-ana:pickup',
        stops: [
          {
            id: 'trip-maria:pickup',
            tripId: 'trip-maria',
            kind: 'pickup',
            place: { latitude: 11.018, longitude: 124.618, label: 'Robinsons Place Ormoc' },
            status: 'pending',
          },
          {
            id: 'trip-ana:pickup',
            tripId: 'trip-ana',
            kind: 'pickup',
            place: { latitude: 11.005, longitude: 124.6075, label: 'Ormoc City Hall' },
            status: 'pending',
          },
        ],
      },
      passengers: [],
      createdAt: { toMillis: () => 1725500000000 } as any,
      completedAt: null,
    };

    const tree = PersistentDriverTripDashboard({
      trip: null,
      sharedRide,
      memberTrips: { 'trip-maria': tripMaria, 'trip-ana': tripAna },
      currentStop: sharedRide.operational?.stops[0] ?? null,
      nextStop: sharedRide.operational?.stops[1] ?? null,
      currentTrip: tripMaria,
      nextTrip: tripAna,
      occupancy: { seatsReserved: 3, maxSeats: 4, onboardCount: 0, waitingCount: 3 },
    });
    const json = JSON.stringify(tree);

    expect(json).toContain('Pick up Maria');
    expect(json).toContain('3 / 4');
    expect(json).toContain('PASSENGERS (2)');
    expect(json).toContain('Ana');
  });

  // 4. Shared member joining active session
  it('Scenario 4: Shared member — joins Shared session with Shared badge, updates occupancy, obeys backend sequence', () => {
    const tripCarloShared: TripDoc = {
      ...baseSoloTrip,
      id: 'trip-carlo',
      mode: 'shared',
      rider: { firstName: 'Carlo' },
      pickup: { label: 'Ormoc Doctor Hospital', coords: { lat: 11.012, lng: 124.61 } },
      destination: { label: 'SM Center Ormoc', coords: { lat: 11.009, lng: 124.608 } },
    };

    const sharedRide: SharedRideDoc = {
      id: 'shared-001',
      driverId: 'driver-1',
      status: 'active',
      maxSeats: 4,
      seatsBooked: 1,
      seatsReserved: 1,
      routePolyline: '',
      routeOrigin: { lat: 11.012, lng: 124.61 },
      routeDestination: { lat: 11.009, lng: 124.608 },
      routeGeohash: '',
      routeHeadingDeg: 0,
      corridorThresholdMeters: 0,
      tripIds: ['trip-carlo'],
      members: [
        {
          tripId: 'trip-carlo',
          passengerId: 'p-carlo',
          seats: 1,
          pickup: { latitude: 11.012, longitude: 124.61, label: 'Ormoc Doctor Hospital' },
          destination: { latitude: 11.009, longitude: 124.608, label: 'SM Center Ormoc' },
          mode: 'shared',
          status: 'reserved',
        },
      ],
      operational: {
        stopOrder: ['trip-carlo:pickup', 'trip-carlo:dropoff'],
        currentStopId: 'trip-carlo:pickup',
        nextStopId: 'trip-carlo:dropoff',
        stops: [
          {
            id: 'trip-carlo:pickup',
            tripId: 'trip-carlo',
            kind: 'pickup',
            place: { latitude: 11.012, longitude: 124.61, label: 'Ormoc Doctor Hospital' },
            status: 'pending',
          },
        ],
      },
      passengers: [],
      createdAt: { toMillis: () => 1725500000000 } as any,
      completedAt: null,
    };

    const tree = PersistentDriverTripDashboard({
      trip: null,
      sharedRide,
      memberTrips: { 'trip-carlo': tripCarloShared },
      currentStop: sharedRide.operational?.stops[0] ?? null,
      currentTrip: tripCarloShared,
      occupancy: { seatsReserved: 1, maxSeats: 4, onboardCount: 0, waitingCount: 1 },
    });
    const json = JSON.stringify(tree);

    expect(json).toContain('Shared');
    expect(json).toContain('Pick up Carlo');
    expect(json).toContain('Ormoc Doctor Hospital');
  });

  // 5. Pickup lifecycle
  it('Scenario 5: Pickup lifecycle — member transitions to in_progress and updates onboard count', () => {
    const tripMariaOnboard: TripDoc = { ...baseSoloTrip, id: 'trip-maria', mode: 'shared', status: 'in_progress', rider: { firstName: 'Maria' } };

    const sharedRide: SharedRideDoc = {
      id: 'shared-001',
      driverId: 'driver-1',
      status: 'active',
      maxSeats: 4,
      seatsBooked: 2,
      seatsReserved: 2,
      routePolyline: '',
      routeOrigin: { lat: 11.018, lng: 124.618 },
      routeDestination: { lat: 11.002, lng: 124.605 },
      routeGeohash: '',
      routeHeadingDeg: 0,
      corridorThresholdMeters: 0,
      tripIds: ['trip-maria'],
      members: [
        {
          tripId: 'trip-maria',
          passengerId: 'p-maria',
          seats: 2,
          pickup: { latitude: 11.018, longitude: 124.618, label: 'Robinsons Place Ormoc' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
          mode: 'shared',
          status: 'onboard',
        },
      ],
      operational: {
        stopOrder: ['trip-maria:dropoff'],
        currentStopId: 'trip-maria:dropoff',
        nextStopId: null,
        stops: [
          {
            id: 'trip-maria:dropoff',
            tripId: 'trip-maria',
            kind: 'dropoff',
            place: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
            status: 'pending',
          },
        ],
      },
      passengers: [],
      createdAt: { toMillis: () => 1725500000000 } as any,
      completedAt: null,
    };

    const tree = PersistentDriverTripDashboard({
      trip: null,
      sharedRide,
      memberTrips: { 'trip-maria': tripMariaOnboard },
      currentStop: sharedRide.operational?.stops[0] ?? null,
      currentTrip: tripMariaOnboard,
      occupancy: { seatsReserved: 2, maxSeats: 4, onboardCount: 2, waitingCount: 0 },
    });
    const json = JSON.stringify(tree);

    expect(json).toContain('CURRENT STOP • DROPOFF');
    expect(json).toContain('Drop off Maria');
    expect(json).toContain('Ormoc Port');
    expect(json).toContain('2 / 4');
    expect(json).toContain('seats reserved');
    expect(json).toContain('onboard');
  });

  // 6. Dropoff lifecycle
  it('Scenario 6: Dropoff lifecycle — one member completes, Shared session continues when other members remain', () => {
    const tripMariaCompleted: TripDoc = { ...baseSoloTrip, id: 'trip-maria', status: 'completed', rider: { firstName: 'Maria' } };
    const tripAnaActive: TripDoc = { ...baseSoloTrip, id: 'trip-ana', status: 'in_progress', rider: { firstName: 'Ana' } };

    const sharedRide: SharedRideDoc = {
      id: 'shared-001',
      driverId: 'driver-1',
      status: 'active',
      maxSeats: 4,
      seatsBooked: 1,
      seatsReserved: 1,
      routePolyline: '',
      routeOrigin: { lat: 11.005, lng: 124.6075 },
      routeDestination: { lat: 11.002, lng: 124.605 },
      routeGeohash: '',
      routeHeadingDeg: 0,
      corridorThresholdMeters: 0,
      tripIds: ['trip-maria', 'trip-ana'],
      members: [
        {
          tripId: 'trip-maria',
          passengerId: 'p-maria',
          seats: 2,
          pickup: { latitude: 11.018, longitude: 124.618, label: 'Robinsons' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
          mode: 'shared',
          status: 'dropped_off',
        },
        {
          tripId: 'trip-ana',
          passengerId: 'p-ana',
          seats: 1,
          pickup: { latitude: 11.005, longitude: 124.6075, label: 'City Hall' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
          mode: 'shared',
          status: 'onboard',
        },
      ],
      operational: {
        stopOrder: ['trip-ana:dropoff'],
        currentStopId: 'trip-ana:dropoff',
        nextStopId: null,
        stops: [
          {
            id: 'trip-ana:dropoff',
            tripId: 'trip-ana',
            kind: 'dropoff',
            place: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
            status: 'pending',
          },
        ],
      },
      passengers: [],
      createdAt: { toMillis: () => 1725500000000 } as any,
      completedAt: null,
    };

    const tree = PersistentDriverTripDashboard({
      trip: null,
      sharedRide,
      memberTrips: { 'trip-maria': tripMariaCompleted, 'trip-ana': tripAnaActive },
      currentStop: sharedRide.operational?.stops[0] ?? null,
      currentTrip: tripAnaActive,
      occupancy: { seatsReserved: 1, maxSeats: 4, onboardCount: 1, waitingCount: 0 },
    });
    const json = JSON.stringify(tree);

    // Active stop is Ana's dropoff
    expect(json).toContain('Drop off Ana');
    expect(json).toContain('1 / 4');
    expect(json).toContain('seats reserved');
    expect(json).toContain('onboard');
    // Maria shows dropped off in list
    expect(json).toContain('Dropped off');
  });

  // 7. Final member
  it('Scenario 7: Final member completes — terminal summary shown, dismiss returns driver', () => {
    const tripMariaCompleted: TripDoc = { ...baseSoloTrip, id: 'trip-maria', status: 'completed', rider: { firstName: 'Maria' } };

    const terminalSharedRide: SharedRideDoc = {
      id: 'shared-001',
      driverId: 'driver-1',
      status: 'completed',
      maxSeats: 4,
      seatsBooked: 0,
      seatsReserved: 0,
      routePolyline: '',
      routeOrigin: { lat: 11.018, lng: 124.618 },
      routeDestination: { lat: 11.002, lng: 124.605 },
      routeGeohash: '',
      routeHeadingDeg: 0,
      corridorThresholdMeters: 0,
      tripIds: ['trip-maria'],
      members: [],
      operational: null,
      passengers: [],
      createdAt: { toMillis: () => 1725500000000 } as any,
      completedAt: { toMillis: () => 1725501000000 } as any,
    };

    const mockDismiss = vi.fn();
    const tree = PersistentDriverTripDashboard({
      trip: null,
      sharedRide: terminalSharedRide,
      memberTrips: { 'trip-maria': tripMariaCompleted },
      currentStop: null,
      currentTrip: null,
      onDismissTerminal: mockDismiss,
    });
    const json = JSON.stringify(tree);

    expect(json).toContain('TRIP COMPLETED');
    expect(json).toContain('Done • Back to Map');

    const primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
    primaryBtn.props.onPress();
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  // 8. Multi-seat
  it('Scenario 8: Multi-seat booking — renders 1 group with N seats without generating duplicate passenger identities', () => {
    const tripMariaMulti: TripDoc = { ...baseSoloTrip, id: 'trip-maria', passengerCount: 3, billedSeats: 3, rider: { firstName: 'Maria' } };

    const sharedRide: SharedRideDoc = {
      id: 'shared-001',
      driverId: 'driver-1',
      status: 'active',
      maxSeats: 4,
      seatsBooked: 3,
      seatsReserved: 3,
      routePolyline: '',
      routeOrigin: { lat: 11.018, lng: 124.618 },
      routeDestination: { lat: 11.002, lng: 124.605 },
      routeGeohash: '',
      routeHeadingDeg: 0,
      corridorThresholdMeters: 0,
      tripIds: ['trip-maria'],
      members: [
        {
          tripId: 'trip-maria',
          passengerId: 'p-maria',
          seats: 3,
          pickup: { latitude: 11.018, longitude: 124.618, label: 'Robinsons' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Port' },
          mode: 'shared',
          status: 'waiting_pickup',
        },
      ],
      operational: {
        stopOrder: ['trip-maria:pickup'],
        currentStopId: 'trip-maria:pickup',
        nextStopId: null,
        stops: [
          {
            id: 'trip-maria:pickup',
            tripId: 'trip-maria',
            kind: 'pickup',
            place: { latitude: 11.018, longitude: 124.618, label: 'Robinsons' },
            status: 'pending',
          },
        ],
      },
      passengers: [],
      createdAt: { toMillis: () => 1725500000000 } as any,
      completedAt: null,
    };

    const tree = PersistentDriverTripDashboard({
      trip: null,
      sharedRide,
      memberTrips: { 'trip-maria': tripMariaMulti },
      currentStop: sharedRide.operational?.stops[0] ?? null,
      currentTrip: tripMariaMulti,
      occupancy: { seatsReserved: 3, maxSeats: 4, onboardCount: 0, waitingCount: 3 },
    });
    const json = JSON.stringify(tree);

    expect(json).toContain('3 seats');
    expect(json).toContain('PASSENGERS (1)');
  });

  // 9. Third-party booking
  it('Scenario 9: Third-party booking — displays traveller first name, "Booked for someone else", and pickup note only at pickup', () => {
    const tripThirdParty: TripDoc = {
      ...baseSoloTrip,
      id: 'trip-other',
      bookingFor: 'other',
      rider: { firstName: 'Carlo' },
      pickupNote: 'Waiting beside gate 2',
    };

    const sharedRide: SharedRideDoc = {
      id: 'shared-001',
      driverId: 'driver-1',
      status: 'active',
      maxSeats: 4,
      seatsBooked: 1,
      seatsReserved: 1,
      routePolyline: '',
      routeOrigin: { lat: 11.018, lng: 124.618 },
      routeDestination: { lat: 11.002, lng: 124.605 },
      routeGeohash: '',
      routeHeadingDeg: 0,
      corridorThresholdMeters: 0,
      tripIds: ['trip-other'],
      members: [
        {
          tripId: 'trip-other',
          passengerId: 'p-other',
          seats: 1,
          pickup: { latitude: 11.018, longitude: 124.618, label: 'Robinsons' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Port' },
          mode: 'shared',
          status: 'waiting_pickup',
        },
      ],
      operational: {
        stopOrder: ['trip-other:pickup'],
        currentStopId: 'trip-other:pickup',
        nextStopId: null,
        stops: [
          {
            id: 'trip-other:pickup',
            tripId: 'trip-other',
            kind: 'pickup',
            place: { latitude: 11.018, longitude: 124.618, label: 'Robinsons' },
            status: 'pending',
          },
        ],
      },
      passengers: [],
      createdAt: { toMillis: () => 1725500000000 } as any,
      completedAt: null,
    };

    const tree = PersistentDriverTripDashboard({
      trip: null,
      sharedRide,
      memberTrips: { 'trip-other': tripThirdParty },
      currentStop: sharedRide.operational?.stops[0] ?? null,
      currentTrip: tripThirdParty,
      occupancy: { seatsReserved: 1, maxSeats: 4, onboardCount: 0, waitingCount: 1 },
    });
    const json = JSON.stringify(tree);

    expect(json).toContain('Pick up Carlo');
    expect(json).toContain('Booked for someone else');
    expect(json).toContain('Waiting beside gate 2');
  });

  // 10. App restart
  it('Scenario 10: App restart — parses activeSharedRideId and restores operational currentStopId from backend projection', () => {
    const rawData = {
      driverId: 'driver-1',
      status: 'active',
      maxSeats: 4,
      seatsReserved: 2,
      createdAt: { toMillis: () => 1725500000000 },
      tripIds: ['trip-reopened'],
      members: [
        {
          tripId: 'trip-reopened',
          passengerId: 'p-reopened',
          seats: 2,
          pickup: { latitude: 11.018, longitude: 124.618, label: 'Restored Place' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Restored Dest' },
          mode: 'shared',
          status: 'waiting_pickup',
        },
      ],
      operational: {
        stopOrder: ['trip-reopened:pickup', 'trip-reopened:dropoff'],
        currentStopId: 'trip-reopened:pickup',
        nextStopId: 'trip-reopened:dropoff',
        stops: [
          {
            id: 'trip-reopened:pickup',
            tripId: 'trip-reopened',
            kind: 'pickup',
            place: { latitude: 11.018, longitude: 124.618, label: 'Restored Place' },
            status: 'pending',
          },
        ],
      },
    };

    const restoredRide = mapCanonicalSharedRide('shared-restored', rawData);
    expect(restoredRide?.id).toBe('shared-restored');
    expect(restoredRide?.operational?.currentStopId).toBe('trip-reopened:pickup');
    expect(restoredRide?.operational?.nextStopId).toBe('trip-reopened:dropoff');
  });

  // 11. Network interruption
  it('Scenario 11: Network interruption — malformed/transient empty snapshots do not corrupt state and map safely', () => {
    const malformedRaw = {
      driverId: 'driver-1',
      status: 'active',
      maxSeats: 4,
      seatsReserved: 0,
      createdAt: { toMillis: () => 1725500000000 },
      tripIds: [],
      members: [],
      operational: null,
    };

    const mapped = mapCanonicalSharedRide('shared-offline', malformedRaw);
    expect(mapped).not.toBeNull();
    expect(mapped?.operational).toBeNull();
  });

  // 12. Cancellation
  it('Scenario 12: Cancellation preserves the selected reason and retains SharedRide', () => {
    typedCancelReason = 'vehicle_issue';
    const tripMaria: TripDoc = { ...baseSoloTrip, id: 'trip-maria', rider: { firstName: 'Maria' } };

    const sharedRide: SharedRideDoc = {
      id: 'shared-001',
      driverId: 'driver-1',
      status: 'active',
      maxSeats: 4,
      seatsBooked: 2,
      seatsReserved: 2,
      routePolyline: '',
      routeOrigin: { lat: 11.018, lng: 124.618 },
      routeDestination: { lat: 11.002, lng: 124.605 },
      routeGeohash: '',
      routeHeadingDeg: 0,
      corridorThresholdMeters: 0,
      tripIds: ['trip-maria'],
      members: [
        {
          tripId: 'trip-maria',
          passengerId: 'p-maria',
          seats: 2,
          pickup: { latitude: 11.018, longitude: 124.618, label: 'Robinsons' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Port' },
          mode: 'shared',
          status: 'waiting_pickup',
        },
      ],
      operational: {
        stopOrder: ['trip-maria:pickup'],
        currentStopId: 'trip-maria:pickup',
        nextStopId: null,
        stops: [
          {
            id: 'trip-maria:pickup',
            tripId: 'trip-maria',
            kind: 'pickup',
            place: { latitude: 11.018, longitude: 124.618, label: 'Robinsons' },
            status: 'pending',
          },
        ],
      },
      passengers: [],
      createdAt: { toMillis: () => 1725500000000 } as any,
      completedAt: null,
    };

    const tree = PersistentDriverTripDashboard({
      trip: null,
      sharedRide,
      memberTrips: { 'trip-maria': tripMaria },
      currentStop: sharedRide.operational?.stops[0] ?? null,
      currentTrip: tripMaria,
      occupancy: { seatsReserved: 2, maxSeats: 4, onboardCount: 0, waitingCount: 2 },
    });

    const confirmCancelBtn = findElementByTestId(tree, 'confirm-cancel-trip-btn');
    confirmCancelBtn.props.onPress();

    expect(mockCancelTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 'trip-maria',
        by: 'driver',
        reason: 'vehicle_issue',
      }),
      expect.any(Object)
    );
  });
});
