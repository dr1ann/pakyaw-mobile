import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  acceptMutate: vi.fn(),
  declineTripOffer: vi.fn(),
  vibrate: vi.fn(),
  removeIncomingRequest: vi.fn(),
  setTripId: vi.fn(),
}));

let stateFeedbackValue: string | null = null;
const mockSetStatusFeedback = vi.fn((val: any) => {
  stateFeedbackValue = typeof val === 'function' ? val(stateFeedbackValue) : val;
});

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: (initial: any) => {
      if (initial === null || typeof initial === 'string') {
        return [stateFeedbackValue ?? initial, mockSetStatusFeedback];
      }
      return [typeof initial === 'function' ? initial() : initial, vi.fn()];
    },
    useCallback: (fn: any) => fn,
    useEffect: vi.fn(),
  };
});

vi.mock('react-native/Libraries/Vibration/Vibration', () => ({
  default: {
    vibrate: mocks.vibrate,
  },
  vibrate: mocks.vibrate,
}));

vi.mock('@/features/matching/services/matching.service', () => ({
  declineTripOffer: mocks.declineTripOffer,
}));

vi.mock('@/features/matching/hooks/useAcceptTrip', () => ({
  useAcceptTrip: () => ({
    mutate: mocks.acceptMutate,
    isPending: false,
  }),
}));

vi.mock('@pakyaw/shared/stores/sessionStore', () => ({
  useSessionStore: (selector: (s: any) => any) => selector({ uid: 'driver-test-1' }),
}));

vi.mock('@pakyaw/shared/stores/activeTripStore', () => ({
  useActiveTripStore: {
    getState: () => ({
      setTripId: mocks.setTripId,
    }),
  },
}));

vi.mock('@/stores/availabilityStore', () => ({
  useAvailabilityStore: Object.assign(
    (selector: (s: any) => any) =>
      selector({
        lastLatitude: 11.002,
        lastLongitude: 124.603,
      }),
    {
      getState: () => ({
        removeIncomingRequest: mocks.removeIncomingRequest,
      }),
    }
  ),
}));

vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

import { IncomingRequestCard } from '@/features/matching/components/IncomingRequestCard';
import type { IncomingRequest } from '@/features/matching/types';

describe('IncomingRequestCard — Phase 11 Driver Incoming Request UI', () => {
  const baseRequest: IncomingRequest = {
    tripId: 'trip-101',
    offerId: 'offer-101',
    mode: 'solo',
    pickup: {
      label: 'Robinsons Place Ormoc',
      address: 'Palo-Carigara-Ormoc Road',
      coords: { lat: 11.005, lng: 124.605 },
    },
    destination: {
      label: 'Ormoc Airport',
      address: 'Airport Road, Ormoc City',
      coords: { lat: 11.055, lng: 124.655 },
    },
    passengerCount: 2,
    billedSeats: 4,
    status: 'pending',
    route: {
      distanceMeters: 4800,
      durationSeconds: 720,
    },
    fare: {
      total: 180,
      driverEarnings: 150,
    },
    offeredAt: 1_700_000_000_000,
    expiresAt: Date.now() + 15_000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stateFeedbackValue = null;
    mocks.declineTripOffer.mockResolvedValue('declined');
  });

  it('renders Pakyaw request with authoritative fare, locations, and mode badge', () => {
    const tree = IncomingRequestCard({ request: baseRequest });
    const json = JSON.stringify(tree);

    expect(json).toContain('PAKYAW');
    expect(json).toContain('2 passengers');
    expect(json).toContain('Robinsons Place Ormoc');
    expect(json).toContain('Ormoc Airport');
    expect(json).toContain('₱180.00');
  });

  it('displays authoritative road-trip distance (4.8 km) and does NOT display ambiguous Haversine distance', () => {
    const tree = IncomingRequestCard({ request: baseRequest });
    const json = JSON.stringify(tree);

    expect(json).toContain('4.8 km trip');
    expect(json).not.toContain('7.6 km trip');
  });

  it('displays driver-to-pickup proximity explicitly labeled separately from trip distance', () => {
    const tree = IncomingRequestCard({ request: baseRequest });
    const json = JSON.stringify(tree);

    expect(json).toContain('Distance to pickup');
    expect(json).toContain('km to pickup');
  });

  it('regression: shows dash for trip distance when authoritative route is missing, NEVER Haversine fallback', () => {
    const requestWithoutRoute: IncomingRequest = {
      ...baseRequest,
      route: null,
    };

    const tree = IncomingRequestCard({ request: requestWithoutRoute });
    const json = JSON.stringify(tree);

    expect(json).toContain('Trip distance');
    expect(json).toContain('—');
    expect(json).not.toMatch(/\d+\.\d+ km trip/);
  });

  it('renders Shared ride request with passenger count and shared notice', () => {
    const sharedRequest: IncomingRequest = {
      ...baseRequest,
      mode: 'shared',
      passengerCount: 1,
      billedSeats: 1,
    };

    const tree = IncomingRequestCard({ request: sharedRequest });
    const json = JSON.stringify(tree);

    expect(json).toContain('SHARED');
    expect(json).toContain('1 passenger');
    expect(json).toContain('Shared ride: other passengers with matching routes may join.');
  });

  it('renders Hop request with hop badge and hop notice', () => {
    const hopRequest: IncomingRequest = {
      ...baseRequest,
      mode: 'hop',
      passengerCount: 1,
      billedSeats: 1,
      sharedRideId: 'shared-session-99',
    };

    const tree = IncomingRequestCard({ request: hopRequest });
    const json = JSON.stringify(tree);

    expect(json).toContain('HOP');
    expect(json).toContain('Hop request: joins your active Shared Ride upon acceptance.');
  });

  it('renders third-party booking notice with rider first name and note without exposing personal info', () => {
    const otherRequest: IncomingRequest = {
      ...baseRequest,
      bookingFor: 'other',
      rider: { firstName: 'Maria' },
      pickupNote: 'Behind the church near mango tree',
    };

    const tree = IncomingRequestCard({ request: otherRequest });
    const json = JSON.stringify(tree);

    expect(json).toContain('Booked for someone else');
    expect(json).toContain('Rider: ');
    expect(json).toContain('Maria');
    expect(json).toContain('Behind the church near mango tree');
    expect(json).not.toMatch(/09\d{9}/);
    expect(json).not.toContain('@');
  });

  it('provides accessible TalkBack labels for Accept and Decline actions', () => {
    const tree = IncomingRequestCard({ request: baseRequest });
    const json = JSON.stringify(tree);

    expect(json).toContain('Accept ride request for ₱180.00');
    expect(json).toContain('Decline ride request');
  });

  describe('Accept & Decline Action Semantics & Race Protections', () => {
    function getButtons(tree: any) {
      let acceptBtn: any = null;
      let declineBtn: any = null;
      function walk(node: any) {
        if (!node || typeof node !== 'object') return;
        if (node.props?.testID === 'accept-button') acceptBtn = node.props;
        if (node.props?.testID === 'decline-button') declineBtn = node.props;
        if (Array.isArray(node.props?.children)) {
          node.props.children.forEach(walk);
        } else if (node.props?.children) {
          walk(node.props.children);
        }
      }
      walk(tree);
      return { acceptBtn, declineBtn };
    }

    it('Accept network error does not become "already taken" and does not discard the offer', () => {
      const tree = IncomingRequestCard({ request: baseRequest });
      const { acceptBtn } = getButtons(tree);

      mocks.acceptMutate.mockImplementation((_vars: any, options: any) => {
        options.onError(new Error('Network request failed'));
      });

      acceptBtn.onPress();

      expect(mockSetStatusFeedback).toHaveBeenCalledWith('Connection error. Please try again.');
      // Must NOT immediately remove the request from the local store
      expect(mocks.removeIncomingRequest).not.toHaveBeenCalled();
    });

    it('already_taken clears the offer and shows calm feedback', () => {
      vi.useFakeTimers();
      const tree = IncomingRequestCard({ request: baseRequest });
      const { acceptBtn } = getButtons(tree);

      mocks.acceptMutate.mockImplementation((_vars: any, options: any) => {
        options.onSuccess('already_taken');
      });

      acceptBtn.onPress();

      expect(mockSetStatusFeedback).toHaveBeenCalledWith('This ride is no longer available.');
      vi.advanceTimersByTime(2500);
      expect(mocks.removeIncomingRequest).toHaveBeenCalledWith('trip-101');
      vi.useRealTimers();
    });

    it('Decline success clears the offer from store', async () => {
      mocks.declineTripOffer.mockResolvedValue('declined');
      const tree = IncomingRequestCard({ request: baseRequest });
      const { declineBtn } = getButtons(tree);

      await declineBtn.onPress();

      expect(mocks.declineTripOffer).toHaveBeenCalledWith('trip-101', 'offer-101', 'driver-test-1');
      expect(mocks.removeIncomingRequest).toHaveBeenCalledWith('trip-101');
    });

    it('Decline network failure does not falsely claim success and preserves offer', async () => {
      mocks.declineTripOffer.mockRejectedValue(new Error('Network timeout'));
      const tree = IncomingRequestCard({ request: baseRequest });
      const { declineBtn } = getButtons(tree);

      await declineBtn.onPress();

      expect(mockSetStatusFeedback).toHaveBeenCalledWith('Connection error. Please try again.');
      // Must NOT remove offer on network failure
      expect(mocks.removeIncomingRequest).not.toHaveBeenCalled();
    });
  });
});
