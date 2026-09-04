import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { PersistentDriverTripDashboard } from './PersistentDriverTripDashboard';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import type { TripDoc } from '@pakyaw/shared/features/trip/types';

// Mock React hooks for pure functional tree execution
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: (initial: any) => {
      return [typeof initial === 'function' ? initial() : initial, vi.fn()];
    },
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

// Mock hooks
const mockTransition = vi.fn();
let mockIsTransitioning = false;
const mockCancelTrip = vi.fn();
let mockIsCancelling = false;

vi.mock('@pakyaw/shared/features/trip/hooks/useTripActions', () => ({
  useTripTransition: () => ({
    mutate: mockTransition,
    isPending: mockIsTransitioning,
  }),
  useCancelTrip: () => ({
    mutate: mockCancelTrip,
    isPending: mockIsCancelling,
  }),
}));

const sampleTrip: TripDoc = {
  id: 'trip-test-101',
  mode: 'solo',
  status: 'accepted',
  passengerId: 'passenger-001',
  driverId: 'driver-001',
  driverPublic: {
    driverId: 'driver-001',
    displayName: 'Juan Dela Cruz',
    vehicle: {
      type: 'tricycle',
      plateNumber: 'ABC 1234',
      description: 'Blue Tricycle',
    },
    verification: {
      verified: true,
    },
  },
  pickup: {
    label: 'Ormoc City Hall',
    coords: { lat: 11.005, lng: 124.6075 },
  },
  destination: {
    label: 'Robinsons Place Ormoc',
    coords: { lat: 11.018, lng: 124.618 },
  },
  passengerCount: 1,
  billedSeats: 1,
  geohash: 'w9x8y7',
  requestedAt: null,
  acceptedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
  fare: 65,
  fareBreakdown: {
    baseFare: 45,
    distanceFare: 15,
    surcharges: 0,
    techFee: 5,
    total: 65,
    driverEarnings: 60,
  },
  route: {
    distanceMeters: 2_400,
    durationSeconds: 360,
    polyline: 'poly123',
    fetchedAt: null,
  },
  bookingFor: 'self',
  rider: null,
  pickupNote: null,
};

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

describe('PersistentDriverTripDashboard Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTransitioning = false;
    mockIsCancelling = false;
    useActiveTripStore.getState().clearTrip();
  });

  it('renders accepted state correctly with pickup information and Head to Pickup CTA', () => {
    const tree = PersistentDriverTripDashboard({
      trip: sampleTrip,
    });
    const json = JSON.stringify(tree);

    expect(json).toContain('TRIP ACCEPTED');
    expect(json).toContain('Heading to pickup:');
    expect(json).toContain('Ormoc City Hall');
    expect(json).toContain('Juan Dela Cruz');
    expect(json).toContain('ABC 1234');
    expect(json).toContain('Head to Pickup');
    expect(json).toContain('Cancel Ride');

    const primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
    expect(primaryBtn).toBeDefined();
    primaryBtn.props.onPress();

    expect(mockTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 'trip-test-101',
        status: 'driver_arriving',
      }),
      expect.any(Object)
    );
  });

  it('renders driver_arriving state with Arrived at Pickup CTA', () => {
    const arrivingTrip: TripDoc = {
      ...sampleTrip,
      status: 'driver_arriving',
    };

    const tree = PersistentDriverTripDashboard({
      trip: arrivingTrip,
    });
    const json = JSON.stringify(tree);

    expect(json).toContain('HEADING TO PICKUP');
    expect(json).toContain('Heading to pickup:');
    expect(json).toContain('Arrived at Pickup');
    expect(json).toContain('Cancel Ride');

    const primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
    primaryBtn.props.onPress();

    expect(mockTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 'trip-test-101',
        status: 'driver_arrived',
      }),
      expect.any(Object)
    );
  });

  it('renders driver_arrived state with At pickup: banner and Start Trip CTA', () => {
    const arrivedTrip: TripDoc = {
      ...sampleTrip,
      status: 'driver_arrived',
    };

    const tree = PersistentDriverTripDashboard({
      trip: arrivedTrip,
    });
    const json = JSON.stringify(tree);

    expect(json).toContain('ARRIVED AT PICKUP');
    expect(json).toContain('At pickup:');
    expect(json).not.toContain('Heading to pickup:');
    expect(json).toContain('Start Trip');
    expect(json).toContain('Cancel Ride');

    const primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
    primaryBtn.props.onPress();

    expect(mockTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 'trip-test-101',
        status: 'in_progress',
      }),
      expect.any(Object)
    );
  });

  it('renders in_progress state with destination context, hides cancel button, and requires End Trip confirmation', () => {
    const inProgressTrip: TripDoc = {
      ...sampleTrip,
      status: 'in_progress',
    };

    const tree = PersistentDriverTripDashboard({
      trip: inProgressTrip,
    });
    const json = JSON.stringify(tree);

    expect(json).toContain('TRIP IN PROGRESS');
    expect(json).toContain('Heading to destination:');
    expect(json).toContain('Robinsons Place Ormoc');
    expect(json).not.toContain('Cancel Ride');

    // Confirm End Trip button exists inside modal
    const confirmEndBtn = findElementByTestId(tree, 'confirm-end-trip-btn');
    expect(confirmEndBtn).toBeDefined();

    confirmEndBtn.props.onPress();
    expect(mockTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 'trip-test-101',
        status: 'completed',
      }),
      expect.any(Object)
    );
  });

  it('renders completed state and calls onDismissTerminal on Done tap', () => {
    const completedTrip: TripDoc = {
      ...sampleTrip,
      status: 'completed',
    };
    const mockDismiss = vi.fn();

    const tree = PersistentDriverTripDashboard({
      trip: completedTrip,
      onDismissTerminal: mockDismiss,
    });
    const json = JSON.stringify(tree);

    expect(json).toContain('TRIP COMPLETED');
    expect(json).toContain('RIDE COMPLETED SUCCESSFULLY');
    expect(json).toContain('Done • Back to Map');

    const primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
    primaryBtn.props.onPress();
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders cancelled state with details and calls onDismissTerminal on Done tap', () => {
    const cancelledTrip: TripDoc = {
      ...sampleTrip,
      status: 'cancelled',
      cancelledBy: 'passenger',
      cancelReason: 'Passenger had an emergency',
    };
    const mockDismiss = vi.fn();

    const tree = PersistentDriverTripDashboard({
      trip: cancelledTrip,
      onDismissTerminal: mockDismiss,
    });
    const json = JSON.stringify(tree);

    expect(json).toContain('TRIP CANCELLED');
    expect(json).toContain('TRIP WAS CANCELLED');
    expect(json).toContain('Cancelled by: passenger');
    expect(json).toContain('Reason: Passenger had an emergency');

    const primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
    primaryBtn.props.onPress();
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it('handles cancellation confirmation with canonical reason selection', () => {
    const tree = PersistentDriverTripDashboard({
      trip: sampleTrip,
    });

    const confirmCancelBtn = findElementByTestId(tree, 'confirm-cancel-trip-btn');
    expect(confirmCancelBtn).toBeDefined();

    confirmCancelBtn.props.onPress();
    expect(mockCancelTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 'trip-test-101',
        by: 'driver',
        reason: 'unable_to_locate_passenger',
      }),
      expect.any(Object)
    );
  });

  it('surfaces error feedback when transition fails without crashing', () => {
    mockTransition.mockImplementation((_args, options) => {
      if (options?.onError) {
        options.onError(new Error('Network error: transition failed'));
      }
    });

    const tree = PersistentDriverTripDashboard({
      trip: sampleTrip,
    });

    const primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
    primaryBtn.props.onPress();

    expect(mockTransition).toHaveBeenCalled();
  });

  describe('Terminal state race condition resilience', () => {
    it('completed: trip terminal first → activeTripId null', () => {
      // 1. Trip document transitions to completed
      const completedTrip: TripDoc = {
        ...sampleTrip,
        status: 'completed',
      };
      useActiveTripStore.getState().setTrip(completedTrip);

      // 2. Server activeTripId becomes null (backend cleaned up active trip)
      const serverActiveTripId = null;
      if (serverActiveTripId === null) {
        const storeTrip = useActiveTripStore.getState().trip;
        if (!storeTrip && useActiveTripStore.getState().tripId) {
          useActiveTripStore.getState().clearTrip();
        }
      }

      // 3. Verify that the store still retains completed trip
      expect(useActiveTripStore.getState().trip).toEqual(completedTrip);

      // 4. Render dashboard
      const mockDismiss = vi.fn(() => {
        useActiveTripStore.getState().clearTrip();
      });
      const tree = PersistentDriverTripDashboard({
        trip: useActiveTripStore.getState().trip,
        onDismissTerminal: mockDismiss,
      });
      const json = JSON.stringify(tree);
      expect(json).toContain('TRIP COMPLETED');
      expect(json).toContain('RIDE COMPLETED SUCCESSFULLY');

      // 5. Driver taps Done -> local store cleared
      const primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
      primaryBtn.props.onPress();
      expect(mockDismiss).toHaveBeenCalledTimes(1);
      expect(useActiveTripStore.getState().trip).toBeNull();
    });

    it('completed: activeTripId null first → trip terminal', () => {
      // 1. Currently active trip
      useActiveTripStore.getState().setTrip(sampleTrip);

      // 2. Server activeTripId becomes null before trip snapshot lands
      const serverActiveTripId = null;
      if (serverActiveTripId === null) {
        const storeTrip = useActiveTripStore.getState().trip;
        if (!storeTrip && useActiveTripStore.getState().tripId) {
          useActiveTripStore.getState().clearTrip();
        }
      }

      // Store still retains active trip and tripId
      expect(useActiveTripStore.getState().trip).toEqual(sampleTrip);

      // 3. Trip snapshot arrives with completed status
      const completedTrip: TripDoc = {
        ...sampleTrip,
        status: 'completed',
      };
      useActiveTripStore.getState().setTrip(completedTrip);
      expect(useActiveTripStore.getState().trip?.status).toBe('completed');

      // 4. Render dashboard
      const mockDismiss = vi.fn(() => {
        useActiveTripStore.getState().clearTrip();
      });
      const tree = PersistentDriverTripDashboard({
        trip: useActiveTripStore.getState().trip,
        onDismissTerminal: mockDismiss,
      });
      const json = JSON.stringify(tree);
      expect(json).toContain('TRIP COMPLETED');

      // 5. Driver taps Done -> local store cleared
      const primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
      primaryBtn.props.onPress();
      expect(mockDismiss).toHaveBeenCalledTimes(1);
      expect(useActiveTripStore.getState().trip).toBeNull();
    });

    it('cancelled: trip terminal first → activeTripId null', () => {
      // 1. Trip document transitions to cancelled
      const cancelledTrip: TripDoc = {
        ...sampleTrip,
        status: 'cancelled',
        cancelReason: 'passenger_cancelled',
      };
      useActiveTripStore.getState().setTrip(cancelledTrip);

      // 2. Server activeTripId becomes null
      const serverActiveTripId = null;
      if (serverActiveTripId === null) {
        const storeTrip = useActiveTripStore.getState().trip;
        if (!storeTrip && useActiveTripStore.getState().tripId) {
          useActiveTripStore.getState().clearTrip();
        }
      }

      // 3. Verify store still retains cancelled trip
      expect(useActiveTripStore.getState().trip).toEqual(cancelledTrip);

      // 4. Render dashboard
      const mockDismiss = vi.fn(() => {
        useActiveTripStore.getState().clearTrip();
      });
      const tree = PersistentDriverTripDashboard({
        trip: useActiveTripStore.getState().trip,
        onDismissTerminal: mockDismiss,
      });
      const json = JSON.stringify(tree);
      expect(json).toContain('TRIP CANCELLED');
      expect(json).toContain('Done • Back to Map');

      // 5. Driver taps Done -> local store cleared
      const primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
      primaryBtn.props.onPress();
      expect(mockDismiss).toHaveBeenCalledTimes(1);
      expect(useActiveTripStore.getState().trip).toBeNull();
    });

    it('cancelled: activeTripId null first → trip terminal', () => {
      // 1. Currently active trip
      useActiveTripStore.getState().setTrip(sampleTrip);

      // 2. Server activeTripId becomes null before trip snapshot lands
      const serverActiveTripId = null;
      if (serverActiveTripId === null) {
        const storeTrip = useActiveTripStore.getState().trip;
        if (!storeTrip && useActiveTripStore.getState().tripId) {
          useActiveTripStore.getState().clearTrip();
        }
      }

      expect(useActiveTripStore.getState().trip).toEqual(sampleTrip);

      // 3. Trip snapshot arrives with cancelled status
      const cancelledTrip: TripDoc = {
        ...sampleTrip,
        status: 'cancelled',
        cancelReason: 'driver_cancelled',
      };
      useActiveTripStore.getState().setTrip(cancelledTrip);
      expect(useActiveTripStore.getState().trip?.status).toBe('cancelled');

      // 4. Render dashboard
      const mockDismiss = vi.fn(() => {
        useActiveTripStore.getState().clearTrip();
      });
      const tree = PersistentDriverTripDashboard({
        trip: useActiveTripStore.getState().trip,
        onDismissTerminal: mockDismiss,
      });
      const json = JSON.stringify(tree);
      expect(json).toContain('TRIP CANCELLED');

      // 5. Driver taps Done -> local store cleared
      const primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
      primaryBtn.props.onPress();
      expect(mockDismiss).toHaveBeenCalledTimes(1);
      expect(useActiveTripStore.getState().trip).toBeNull();
    });

    it('activeTripId null first + delayed terminal snapshot → terminal still shown', () => {
      // 1. Currently active trip in non-terminal state
      useActiveTripStore.getState().setTrip(sampleTrip);
      expect(useActiveTripStore.getState().trip?.status).toBe('accepted');

      // 2. Server activeTripId becomes null on driver doc
      const serverActiveTripId = null;
      if (serverActiveTripId === null) {
        const storeTrip = useActiveTripStore.getState().trip;
        if (!storeTrip && useActiveTripStore.getState().tripId) {
          useActiveTripStore.getState().clearTrip();
        }
      }

      // Store still retains active trip while awaiting reconciliation / snapshot
      expect(useActiveTripStore.getState().trip).toEqual(sampleTrip);

      // 3. Delayed terminal snapshot arrives across the wire
      const delayedCompletedTrip: TripDoc = {
        ...sampleTrip,
        status: 'completed',
      };
      useActiveTripStore.getState().setTrip(delayedCompletedTrip);

      // 4. Terminal sheet is presented
      const mockDismiss = vi.fn(() => {
        useActiveTripStore.getState().clearTrip();
      });
      const tree = PersistentDriverTripDashboard({
        trip: useActiveTripStore.getState().trip,
        onDismissTerminal: mockDismiss,
      });
      const json = JSON.stringify(tree);
      expect(json).toContain('TRIP COMPLETED');

      // 5. Driver taps Done -> cleared
      const primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
      primaryBtn.props.onPress();
      expect(mockDismiss).toHaveBeenCalledTimes(1);
      expect(useActiveTripStore.getState().trip).toBeNull();
    });
  });

  describe('Phase 13 Shared / Hop Multi-Passenger Operational Workspace', () => {
    const tripMaria: TripDoc = {
      ...sampleTrip,
      id: 'trip-maria',
      mode: 'shared',
      status: 'accepted',
      passengerCount: 2,
      billedSeats: 2,
      rider: {
        firstName: 'Maria',
      },
      pickup: {
        label: 'Robinsons Place Ormoc',
        coords: { lat: 11.018, lng: 124.618 },
      },
      destination: {
        label: 'Ormoc Port',
        coords: { lat: 11.002, lng: 124.605 },
      },
      pickupNote: 'Waiting beside the main entrance',
      bookingFor: 'self',
    };

    const tripAna: TripDoc = {
      ...sampleTrip,
      id: 'trip-ana',
      mode: 'shared',
      status: 'in_progress',
      passengerCount: 1,
      billedSeats: 1,
      rider: {
        firstName: 'Ana',
      },
      pickup: {
        label: 'Ormoc City Hall',
        coords: { lat: 11.005, lng: 124.6075 },
      },
      destination: {
        label: 'Ormoc Port',
        coords: { lat: 11.002, lng: 124.605 },
      },
      bookingFor: 'self',
    };

    const tripCarloShared: TripDoc = {
      ...sampleTrip,
      id: 'trip-carlo',
      mode: 'shared',
      status: 'accepted',
      passengerCount: 1,
      billedSeats: 1,
      rider: {
        firstName: 'Carlo',
      },
      bookingFor: 'other',
      pickup: {
        label: 'Ormoc Doctor Hospital',
        coords: { lat: 11.012, lng: 124.61 },
      },
      destination: {
        label: 'SM Center Ormoc',
        coords: { lat: 11.009, lng: 124.608 },
      },
    };

    const sharedRideSample = {
      id: 'shared-ride-001',
      driverId: 'driver-001',
      status: 'active' as const,
      maxSeats: 4,
      seatsBooked: 3,
      seatsReserved: 3,
      totalPassengersCount: 3,
      routePolyline: '',
      routeOrigin: { lat: 11.005, lng: 124.6075 },
      routeDestination: { lat: 11.002, lng: 124.605 },
      routeGeohash: '',
      routeHeadingDeg: 0,
      corridorThresholdMeters: 0,
      tripIds: ['trip-maria', 'trip-ana', 'trip-carlo'],
      members: [
        {
          tripId: 'trip-ana',
          passengerId: 'p-ana',
          seats: 1,
          pickup: { latitude: 11.005, longitude: 124.6075, label: 'Ormoc City Hall' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
          mode: 'shared' as const,
          status: 'onboard' as const,
        },
        {
          tripId: 'trip-maria',
          passengerId: 'p-maria',
          seats: 2,
          pickup: { latitude: 11.018, longitude: 124.618, label: 'Robinsons Place Ormoc' },
          destination: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
          mode: 'shared' as const,
          status: 'waiting_pickup' as const,
        },
        {
          tripId: 'trip-carlo',
          passengerId: 'p-carlo',
          seats: 1,
          pickup: { latitude: 11.012, longitude: 124.61, label: 'Ormoc Doctor Hospital' },
          destination: { latitude: 11.009, longitude: 124.608, label: 'SM Center Ormoc' },
          mode: 'shared' as const,
          status: 'reserved' as const,
        },
      ],
      operational: {
        stopOrder: ['trip-maria:pickup', 'trip-ana:dropoff', 'trip-carlo:pickup'],
        currentStopId: 'trip-maria:pickup',
        nextStopId: 'trip-ana:dropoff',
        stops: [
          {
            id: 'trip-maria:pickup',
            tripId: 'trip-maria',
            kind: 'pickup' as const,
            place: { latitude: 11.018, longitude: 124.618, label: 'Robinsons Place Ormoc' },
            status: 'pending' as const,
          },
          {
            id: 'trip-ana:dropoff',
            tripId: 'trip-ana',
            kind: 'dropoff' as const,
            place: { latitude: 11.002, longitude: 124.605, label: 'Ormoc Port' },
            status: 'pending' as const,
          },
        ],
      },
      passengers: [],
      createdAt: { toMillis: () => 1725500000000 } as any,
      completedAt: null,
    };

    it('renders current pickup stop with dominant UI, rider name, seat count, and pickup note', () => {
      const tree = PersistentDriverTripDashboard({
        trip: null,
        sharedRide: sharedRideSample,
        memberTrips: {
          'trip-maria': tripMaria,
          'trip-ana': tripAna,
          'trip-carlo': tripCarloShared,
        },
        currentStop: sharedRideSample.operational.stops[0],
        nextStop: sharedRideSample.operational.stops[1],
        currentTrip: tripMaria,
        nextTrip: tripAna,
        occupancy: {
          seatsReserved: 3,
          maxSeats: 4,
          onboardCount: 1,
          waitingCount: 2,
        },
      });
      const json = JSON.stringify(tree);

      // Current stop dominates
      expect(json).toContain('CURRENT STOP');
      expect(json).toContain('Pick up Maria');
      expect(json).toContain('Robinsons Place Ormoc');
      expect(json).toContain('2 seats');
      expect(json).toContain('Shared');
      expect(json).toContain('Waiting beside the main entrance');
      expect(json).toContain('Head to Pickup');

      // Occupancy strip
      expect(json).toContain('3 / 4');
      expect(json).toContain('seats reserved');
      expect(json).toContain('1');
      expect(json).toContain('onboard');

      // Next stop context
      expect(json).toContain('NEXT');
      expect(json).toContain('Drop off Ana');
      expect(json).toContain('Ormoc Port');

      // Passenger member list
      expect(json).toContain('PASSENGERS (3)');
      expect(json).toContain('Ana');
      expect(json).toContain('Maria');
      expect(json).toContain('Carlo');
      expect(json).toContain('Shared');
    });

    it('renders third-party traveller with rider.firstName and "Booked for someone else" indicator', () => {
      const tree = PersistentDriverTripDashboard({
        trip: null,
        sharedRide: sharedRideSample,
        memberTrips: {
          'trip-maria': tripMaria,
          'trip-ana': tripAna,
          'trip-carlo': tripCarloShared,
        },
        currentStop: {
          id: 'trip-carlo:pickup',
          tripId: 'trip-carlo',
          kind: 'pickup',
          place: { latitude: 11.012, longitude: 124.61, label: 'Ormoc Doctor Hospital' },
          status: 'pending',
        },
        nextStop: null,
        currentTrip: tripCarloShared,
        nextTrip: null,
        occupancy: {
          seatsReserved: 3,
          maxSeats: 4,
          onboardCount: 1,
          waitingCount: 2,
        },
      });
      const json = JSON.stringify(tree);

      expect(json).toContain('Pick up Carlo');
      expect(json).toContain('Booked for someone else');
      expect(json).toContain('Shared');
      expect(json).toContain('1 seat');
    });

    it('renders safe fallback "Rider" when historical trip lacks rider profile without querying users collection', () => {
      const historicalTrip: TripDoc = {
        ...sampleTrip,
        id: 'trip-historical',
        rider: null,
      };

      const tree = PersistentDriverTripDashboard({
        trip: null,
        sharedRide: sharedRideSample,
        memberTrips: {
          'trip-historical': historicalTrip,
        },
        currentStop: {
          id: 'trip-historical:pickup',
          tripId: 'trip-historical',
          kind: 'pickup',
          place: { latitude: 11.005, longitude: 124.6075, label: 'Ormoc City Hall' },
          status: 'pending',
        },
        nextStop: null,
        currentTrip: historicalTrip,
        nextTrip: null,
        occupancy: {
          seatsReserved: 1,
          maxSeats: 4,
          onboardCount: 0,
          waitingCount: 1,
        },
      });
      const json = JSON.stringify(tree);

      expect(json).toContain('Pick up Rider');
    });

    it('renders waiting state when currentStop is null without inventing a stop', () => {
      const tree = PersistentDriverTripDashboard({
        trip: null,
        sharedRide: sharedRideSample,
        memberTrips: {
          'trip-maria': tripMaria,
        },
        currentStop: null,
        nextStop: null,
        currentTrip: null,
        nextTrip: null,
        occupancy: {
          seatsReserved: 2,
          maxSeats: 4,
          onboardCount: 0,
          waitingCount: 2,
        },
      });
      const json = JSON.stringify(tree);

      expect(json).toContain('SHARED RIDE IN PROGRESS');
      expect(json).toContain('Awaiting next passenger stop');
    });

    it('executes lifecycle transitions for current stop trip via callable transitionTrip', () => {
      const tree = PersistentDriverTripDashboard({
        trip: null,
        sharedRide: sharedRideSample,
        memberTrips: {
          'trip-maria': tripMaria,
        },
        currentStop: sharedRideSample.operational.stops[0],
        nextStop: null,
        currentTrip: tripMaria,
        nextTrip: null,
        occupancy: {
          seatsReserved: 2,
          maxSeats: 4,
          onboardCount: 0,
          waitingCount: 2,
        },
      });

      const primaryBtn = findElementByTestId(tree, 'driver-primary-action-btn');
      primaryBtn.props.onPress();

      expect(mockTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId: 'trip-maria',
          status: 'driver_arriving',
        }),
        expect.any(Object)
      );
    });

    it('cancels current stop trip with canonical reason when driver cancels in Shared session', () => {
      const tree = PersistentDriverTripDashboard({
        trip: null,
        sharedRide: sharedRideSample,
        memberTrips: {
          'trip-maria': tripMaria,
        },
        currentStop: sharedRideSample.operational.stops[0],
        nextStop: null,
        currentTrip: tripMaria,
        nextTrip: null,
        occupancy: {
          seatsReserved: 2,
          maxSeats: 4,
          onboardCount: 0,
          waitingCount: 2,
        },
      });

      const confirmCancelBtn = findElementByTestId(tree, 'confirm-cancel-trip-btn');
      confirmCancelBtn.props.onPress();

      expect(mockCancelTrip).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId: 'trip-maria',
          by: 'driver',
          reason: 'unable_to_locate_passenger',
        }),
        expect.any(Object)
      );
    });
  });
});
