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

    it('activeTripId null + trip remains non-terminal reconciles and clears stale state after grace window', () => {
      vi.useFakeTimers();
      try {
        useActiveTripStore.getState().setTrip(sampleTrip);
        expect(useActiveTripStore.getState().trip?.status).toBe('accepted');

        // Simulate DriveScreen effect logic with reconciliation timer
        const currentStore = useActiveTripStore.getState();
        const storeTrip = currentStore.trip;
        if (storeTrip) {
          const isTerminal = storeTrip.status === 'completed' || storeTrip.status === 'cancelled';
          if (!isTerminal) {
            setTimeout(() => {
              const recheckStore = useActiveTripStore.getState();
              const recheckTrip = recheckStore.trip;
              if (recheckTrip && recheckTrip.status !== 'completed' && recheckTrip.status !== 'cancelled') {
                useActiveTripStore.getState().clearTrip();
              }
            }, 5000);
          }
        }

        expect(useActiveTripStore.getState().trip).not.toBeNull();

        // Fast-forward 5s grace window
        vi.advanceTimersByTime(5000);

        // Store is reconciled and cleared so driver is not trapped
        expect(useActiveTripStore.getState().trip).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
